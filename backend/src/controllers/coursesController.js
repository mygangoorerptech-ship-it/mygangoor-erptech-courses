// backend/src/controllers/coursesController.js
import mongoose from "mongoose";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { getPlatformFeePaise } from "../config/platform.js";
import { safeRegex } from "../utils/safeRegex.js";

// ── Center assignment helpers ─────────────────────────────────────────────────

async function fetchCenterIdsForCourse(courseId) {
  const CourseAssignment = (await import("../models/CourseAssignment.js")).default;
  const assignments = await CourseAssignment.find({ courseId }).select("centerId").lean();
  return assignments.map((a) => a.centerId.toString());
}

async function fetchCenterMap(courseIds) {
  if (!courseIds.length) return new Map();

  const CourseAssignment = (await import("../models/CourseAssignment.js")).default;
  const Organization = (await import("../models/Organization.js")).default;

  const assignments = await CourseAssignment.find({
    courseId: { $in: courseIds }
  }).lean();

  const centerIds = [...new Set(assignments.map(a => a.centerId.toString()))];

  const orgs = await Organization.find({
    _id: { $in: centerIds }
  }).select("_id name").lean();

  const orgMap = new Map(orgs.map(o => [o._id.toString(), o.name]));

  const map = new Map();

  for (const a of assignments) {
    const key = a.courseId.toString();

    if (!map.has(key)) {
      map.set(key, { ids: [], names: [] });
    }

    const centerId = a.centerId.toString();
    map.get(key).ids.push(centerId);
    map.get(key).names.push(orgMap.get(centerId) || "Unknown");
  }

  return map;
}

async function syncCenterAssignments(courseId, orgId, centerIds, actorId) {
  const CourseAssignment = (await import("../models/CourseAssignment.js")).default;
  const Organization = (await import("../models/Organization.js")).default;

  const existing = await CourseAssignment.find({ courseId }).lean();
  const existingIds = new Set(existing.map((e) => e.centerId.toString()));
  const newIds = new Set(
    (Array.isArray(centerIds) ? centerIds : [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map(String)
  );

  const toDelete = [...existingIds].filter((id) => !newIds.has(id));
  const toAdd = [...newIds].filter((id) => !existingIds.has(id));

  if (toDelete.length > 0) {
    await CourseAssignment.deleteMany({ courseId, centerId: { $in: toDelete } });
  }
  if (toAdd.length > 0) {
    const validCenters = await Organization.find({
      _id: { $in: toAdd },
      deletedAt: null,
      status: "active",
    }).select("_id").lean();
    const toInsert = validCenters.map((c) => ({
      courseId, centerId: c._id, assignedBy: actorId, isActive: true,
    }));
    if (toInsert.length > 0) {
      await CourseAssignment.insertMany(toInsert, { ordered: false });
    }
  }
}

const idOf = (v) =>
  (v && typeof v === "object" && v._id)
    ? v._id
    : v;

function clampDiscount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}

function sanitize(doc, centerIds = [], centerNames = []) {
  const o = doc.toObject ? doc.toObject() : doc;

  const price = Number.isFinite(o.price) ? o.price : 0;
  const d = Number.isFinite(o.discountPercent) ? clampDiscount(o.discountPercent) : 0;
  const priceAfterDiscount = Math.max(0, Math.round(price * (100 - d) / 100));
  const fee = Number.isFinite(o.platformFee) ? o.platformFee : 0;
  const totalWithFees = priceAfterDiscount + (fee >= 0 ? fee : 0);

  return {
    id: String(o._id),
    title: o.title,
    slug: o.slug || null,
    description: o.description || null,
    category: o.category || null,
    programType: o.programType || null,
    price: o.price ?? 0,
    visibility: o.visibility || "unlisted",
    status: o.status || "draft",

    orgId: o.orgId ? String(o.orgId) : null,
    ownerId: o.ownerId ? String(o.ownerId) : null,
    createdById: o.createdById ? String(o.createdById) : null,

    courseType: o.courseType || "paid",
    durationText: o.durationText || "",
    teacherId: o.teacherId ? String(o.teacherId) : null,
    centerTeacherAssignments: Array.isArray(o.centerTeacherAssignments)
      ? o.centerTeacherAssignments.map((x) => ({
        centerId:
          x?.centerId &&
            mongoose.Types.ObjectId.isValid(idOf(x.centerId))
            ? String(idOf(x.centerId))
            : null,
        teacherId:
          x?.teacherId &&
            mongoose.Types.ObjectId.isValid(idOf(x.teacherId))
            ? String(idOf(x.teacherId))
            : null,
        teacherIds: Array.isArray(x?.teacherIds)
          ? x.teacherIds.map(id => String(id)).filter(Boolean)
          : (x?.teacherId ? [String(idOf(x.teacherId))] : []),
        teacherName: x?.teacherName || null,
        teacherEmail: x?.teacherEmail || null,
      }))
      : [],

    isBundled: !!o.isBundled,
    chapters: Array.isArray(o.chapters) ? o.chapters : [],
    demoVideoUrl: o.demoVideoUrl || null,

    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    tags: Array.isArray(o.tags) ? o.tags : [],

    discountPercent: Number.isFinite(o.discountPercent) ? clampDiscount(o.discountPercent) : 0,
    level: o.level || "all",
    bundleCoverUrl: o.bundleCoverUrl || null,
    platformFee: Number.isFinite(o.platformFee) ? o.platformFee : 0,

    priceAfterDiscount,
    totalWithFees,

    // ✅ FIX
    centerIds: Array.isArray(centerIds) ? centerIds : [],
    centerNames: Array.isArray(centerNames) ? centerNames : [],
  };
}

// GET /courses  (admin + teacher + student read within org)
export async function list(req, res) {
  const actor = req.user;
  if (!actor?.orgId && actor?.role !== "superadmin") {
    return res.status(403).json({
      ok: false,
      message: "No org"
    });
  }

  const { q, status = "all", page, limit } = req.query || {};
  const CourseAssignment = (await import("../models/CourseAssignment.js")).default;

  // 1. find courses assigned to this org (center)
  let and = [];

  if (actor.role === "superadmin") {

    and = [{}];

  } else if (actor.role === "teacher") {

    const actorId    = actor._id || actor.id || actor.sub;
    const actorIdStr = String(actorId);
    const orgIdStr   = String(actor.orgId);
    and = [{
      $or: [
        { teacherId: actorIdStr },
        { teacherId: new mongoose.Types.ObjectId(actorIdStr) },
        {
          centerTeacherAssignments: {
            $elemMatch: {
              $or: [
                { centerId: orgIdStr,                               teacherId: actorIdStr },
                { centerId: new mongoose.Types.ObjectId(orgIdStr),  teacherId: new mongoose.Types.ObjectId(actorIdStr) },
                { centerId: orgIdStr,                               teacherIds: actorIdStr },
                { centerId: new mongoose.Types.ObjectId(orgIdStr),  teacherIds: new mongoose.Types.ObjectId(actorIdStr) },
              ]
            }
          }
        }
      ]
    }];

  } else {

    const assigned = await CourseAssignment.find({
      centerId: actor.orgId
    }).select("courseId").lean();

    const assignedIds = assigned.map(a => a.courseId);

    const allAssignedCourseIds =
      await CourseAssignment.distinct("courseId");

    and = [{
      $or: [
        { orgId: actor.orgId },
        { _id: { $in: assignedIds } },
        { _id: { $nin: allAssignedCourseIds } }
      ]
    }];
  }

  if (q) {
    // H-4 fix: escape metacharacters to prevent ReDoS
    const rx = { $regex: safeRegex(q), $options: "i" };
    and.push({ $or: [{ title: rx }, { slug: rx }, { category: rx }, { programType: rx }, { description: rx }, { tags: rx }] });
  }
  if (status !== "all") and.push({ status });

  const where = { $and: and };
  if (page !== undefined || limit !== undefined) {
    const p = Math.max(1, Number(page) || 1);
    const sz = Math.min(10, Math.max(1, Number(limit) || 10)); // cap at 10
    const total = await Course.countDocuments(where);
    const docs = await Course.find(where)
      .sort({ createdAt: -1 })
      .skip((p - 1) * sz)
      .limit(sz);
    const centerMap = await fetchCenterMap(docs.map(d => d._id));
    return res.json({
      items: docs.map((d) => {
        const cm = centerMap.get(d._id.toString()) || { ids: [], names: [] };
        return sanitize(d, cm.ids, cm.names);
      }),
      total,
      page: p,
      pageSize: sz
    });
  }
  // Legacy non-paginated
  const docs = await Course.find(where).sort({ createdAt: -1 });
  const centerMap = await fetchCenterMap(docs.map(d => d._id));
  return res.json(
    docs.map((d) => {
      const cm = centerMap.get(d._id.toString()) || { ids: [], names: [] };
      return sanitize(d, cm.ids, cm.names);
    })
  );
}

// POST /courses
export async function create(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const {
    title, slug, description, category, programType, price, visibility, status, tags,
    isBundled, chapters, demoVideoUrl,
    courseType, durationText, teacherId, centerTeacherAssignments,
    discountPercent, level, bundleCoverUrl, platformFee,
    centerIds,
  } = req.body || {};

  if (!title) return res.status(400).json({ ok: false, message: "title required" });
  if (!programType) return res.status(400).json({ ok: false, message: "programType required" });

  let validatedCenterTeacherAssignments = [];

  if (Array.isArray(centerTeacherAssignments)) {
    for (const item of centerTeacherAssignments) {
      if (!item?.centerId) continue;

      // Support both old teacherId (string) and new teacherIds (array)
      const rawTeacherIds = item.teacherIds?.length
        ? item.teacherIds
        : (item.teacherId ? [item.teacherId] : []);

      if (rawTeacherIds.length === 0) continue;

      const alreadyExists = validatedCenterTeacherAssignments.some(
        (x) => String(x.centerId) === String(item.centerId)
      );
      if (alreadyExists) continue;

      // Validate each teacher belongs to this center
      const validatedTeachers = await User.find({
        _id: { $in: rawTeacherIds },
        role: "teacher",
        orgId: item.centerId,
      }).select("_id name email").lean();

      if (validatedTeachers.length === 0) continue;

      const firstTeacher = validatedTeachers[0];
      validatedCenterTeacherAssignments.push({
        centerId: String(item.centerId),
        teacherId: firstTeacher._id,           // backward compat: first teacher
        teacherIds: validatedTeachers.map(t => t._id),
        teacherName: firstTeacher.name || null,
        teacherEmail: firstTeacher.email || null,
      });
    }
  }

  const payload = {
    title,
    slug,
    description,
    category,
    programType,
    price: Number.isFinite(Number(price))
      ? Math.round(Number(price))
      : 0,
    visibility: visibility || "unlisted",
    status: status || "draft",
    orgId: actor.orgId,

    // Ownership: ownerId = admin for attribution, createdById = who actually created (admin or teacher)
    ownerId: (actor.role === "teacher") ? (actor.managerId || null) : (actor._id || actor.sub || null),
    createdById: actor._id || actor.sub,
    managerId: (actor.role === "teacher") ? (actor.managerId || null) : null,

    courseType: (courseType === "free" ? "free" : "paid"),
    durationText: typeof durationText === "string" ? durationText : "",
    teacherId:
      validatedCenterTeacherAssignments[0]?.teacherId || null,

    centerTeacherAssignments:
      validatedCenterTeacherAssignments,

    isBundled: !!isBundled,
    chapters: Array.isArray(chapters) ? chapters : [],
    demoVideoUrl: demoVideoUrl || null,

    tags: Array.isArray(tags)
      ? tags
      : (typeof tags === "string"
        ? String(tags).split(",").map((s) => s.trim()).filter(Boolean)
        : []),

    // NEW bundle-level fields (validated)
    discountPercent: Number.isFinite(Number(discountPercent))
      ? clampDiscount(Number(discountPercent))
      : 0,
    level: (level || "all").toLowerCase(),
    bundleCoverUrl: bundleCoverUrl || null,
    platformFee: Number.isFinite(Number(platformFee))
      ? Number(platformFee)
      : getPlatformFeePaise()
  };

  // Wrap course creation + center assignments in a transaction so partial failures roll back
  const session = await mongoose.startSession();
  let doc;

  try {
    await session.withTransaction(async () => {
      [doc] = await Course.create([payload], { session });

      if (Array.isArray(centerIds) && centerIds.length > 0) {
        const CourseAssignment = (await import("../models/CourseAssignment.js")).default;
        const Organization = (await import("../models/Organization.js")).default;

        const centerIdsSafe = (Array.isArray(centerIds) ? centerIds : [])
          .filter((id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id));

        const validCenters = await Organization.find({
          _id: { $in: centerIdsSafe },
          deletedAt: null,
          status: "active",
        }).select("_id").lean().session(session);

        const assignments = validCenters.map((c) => ({
          courseId: doc._id,
          centerId: c._id,
          assignedBy: actor._id || actor.sub,
          isActive: true,
        }));

        if (assignments.length > 0) {
          await CourseAssignment.insertMany(assignments, { session, ordered: false });
        }
      }
    });
  } catch (err) {
    console.error("❌ Course create failed:", err);
    return res.status(500).json({
      ok: false,
      message: err.message || "Course creation failed"
    });
  } finally {
    session.endSession();
  }
  // Notify all active students in org about the new course (one-time)
  try {
    const { enqueueNotification } = await import("./notificationsController.js");
    const UserModel = (await import("../models/User.js")).default;
    const students = await UserModel.find({ role: "student", status: "active", orgId: actor.orgId }).select("_id").lean();
    for (const s of students) {
      await enqueueNotification({
        userId: s._id,
        orgId: actor.orgId,
        type: "new_course",
        title: "New course added",
        body: `"${title}" is now available. Check it out!`,
        data: { courseId: doc._id },
        dueAt: new Date(),
        recurrence: "none",
        maxTimes: 1,
      });
    }
  } catch (e) { console.error("[notify] new_course enqueue failed", e?.message || e); }

  const centerMap = await fetchCenterMap([doc._id]);
  const cm = centerMap.get(doc._id.toString()) || { ids: [], names: [] };

  return res.json(sanitize(doc, cm.ids, cm.names));
}

// PATCH /courses/:id  (edit only if you created it)
export async function patch(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false });

  const { id } = req.params;

  const baseAllow = [
    "title", "slug", "description", "category", "programType", "price",
    "visibility", "status", "tags", "isBundled", "chapters", "demoVideoUrl",
    "courseType", "durationText",
  ];

  const patch = {};

  if (Array.isArray(req.body?.centerTeacherAssignments)) {
    const validated = [];

    for (const item of req.body.centerTeacherAssignments) {
      if (!item?.centerId) continue;

      const rawTeacherIds = item.teacherIds?.length
        ? item.teacherIds
        : (item.teacherId ? [item.teacherId] : []);

      if (rawTeacherIds.length === 0) continue;

      const alreadyExists = validated.some(
        (x) => String(x.centerId) === String(item.centerId)
      );
      if (alreadyExists) continue;

      const validatedTeachers = await User.find({
        _id: { $in: rawTeacherIds },
        orgId: item.centerId,
        role: "teacher",
      }).select("_id name email").lean();

      if (validatedTeachers.length === 0) continue;

      const firstTeacher = validatedTeachers[0];
      validated.push({
        centerId: String(item.centerId),
        teacherId: firstTeacher._id,
        teacherIds: validatedTeachers.map(t => t._id),
        teacherName: firstTeacher.name || null,
        teacherEmail: firstTeacher.email || null,
      });
    }

    if (
      req.body.centerTeacherAssignments.length === 0 ||
      validated.length > 0
    ) {
      patch.centerTeacherAssignments = validated;
      patch.teacherId = validated[0]?.teacherId || null;
    }
  }
  // allow base fields
  for (const k of baseAllow) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, k)) {
      if (k === "courseType") patch[k] = (req.body[k] === "free" ? "free" : "paid");
      else if (k === "price") {
        const np = Number(req.body[k]);
        patch[k] = Number.isFinite(np) ? Math.round(np) : 0;
      }
      else {
        patch[k] = req.body[k];
      }
    }
  }
  // allow NEW bundle-level fields with validation
  if (Number.isFinite(Number(req.body?.discountPercent))) {
    patch.discountPercent = clampDiscount(Number(req.body.discountPercent));
  }
  if (typeof req.body?.level === "string") {
    patch.level = String(req.body.level).toLowerCase();
  }
  if (typeof req.body?.bundleCoverUrl === "string") {
    patch.bundleCoverUrl = req.body.bundleCoverUrl;
  }
  if (Number.isFinite(Number(req.body?.platformFee))) {
    patch.platformFee = Number(req.body.platformFee);
  }

  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ ok: false });

const actorId = String(actor._id || actor.sub);
const actorOrgId = String(actor.orgId);

const isOwner =
  String(doc.createdById) === actorId;

const isAssignedTeacher =
  Array.isArray(doc.centerTeacherAssignments) &&
  doc.centerTeacherAssignments.some(
    (x) =>
      String(x.centerId) === actorOrgId &&
      (String(x.teacherId) === actorId ||
       (Array.isArray(x.teacherIds) && x.teacherIds.some(id => String(id) === actorId)))
  );

const centerIdsForCourse = await fetchCenterIdsForCourse(id);
const isOwnCenterAdmin =
  actor.role === "admin" &&
  centerIdsForCourse.some((cId) => cId === actorOrgId);

if (
  !isOwner &&
  !isAssignedTeacher &&
  !isOwnCenterAdmin &&
  actor.role !== "superadmin"
) {
  return res.status(403).json({
    ok: false,
    message: "Not allowed"
  });
}

  if (isOwnCenterAdmin && actor.role !== "superadmin") {
    const existing = Array.isArray(doc.centerTeacherAssignments)
      ? doc.centerTeacherAssignments
      : [];

    if (patch.centerTeacherAssignments !== undefined) {
      const ownEntry = patch.centerTeacherAssignments.find(
        (x) => String(x.centerId) === actorOrgId
      );
      const existingOwnEntry = existing.find(
        (x) => String(x.centerId) === actorOrgId
      );
      patch.centerTeacherAssignments = [
        ...existing.filter((x) => String(x.centerId) !== actorOrgId),
        ...(ownEntry ? [ownEntry] : existingOwnEntry ? [existingOwnEntry] : []),
      ];
    }
    delete patch.teacherId;
  }

  const updated = await Course.findByIdAndUpdate(id, { $set: patch }, { new: true });

  // Diff-based center assignment sync (only runs when centerIds is explicitly provided)
  const { centerIds } = req.body || {};
  if (Array.isArray(centerIds) && !isOwnCenterAdmin) {
    await syncCenterAssignments(
      updated._id,
      updated.orgId,
      centerIds,
      actor._id || actor.sub
    );
  }

  const centerMap = await fetchCenterMap([updated._id]);
  const cm = centerMap.get(updated._id.toString()) || { ids: [], names: [] };

  return res.json(sanitize(updated, cm.ids, cm.names));
}

// POST /courses/:id/status
export async function setStatus(req, res) {
  const actor = req.user;
  const { id } = req.params;
  const { status } = req.body || {};
  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ ok: false });

const actorId = String(actor._id || actor.sub);
const actorOrgId = String(actor.orgId);

const isOwner =
  String(doc.createdById) === actorId;

const isAssignedTeacher =
  Array.isArray(doc.centerTeacherAssignments) &&
  doc.centerTeacherAssignments.some(
    (x) =>
      String(x.centerId) === actorOrgId &&
      (String(x.teacherId) === actorId ||
       (Array.isArray(x.teacherIds) && x.teacherIds.some(id => String(id) === actorId)))
  );

if (
  !isOwner &&
  !isAssignedTeacher &&
  actor.role !== "superadmin"
) {
  return res.status(403).json({
    ok: false,
    message: "Not allowed"
  });
}

  const next = await Course.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  const centerMap = await fetchCenterMap([next._id]);
  const cm = centerMap.get(next._id.toString()) || { ids: [], names: [] };

  return res.json(sanitize(next, cm.ids, cm.names));
}

// DELETE /courses/:id
export async function remove(req, res) {
  const actor = req.user;
  const { id } = req.params;

  const doc = await Course.findById(id);
  if (!doc) return res.status(404).json({ ok: false });

  // SA/global course cannot be deleted by org admins/teachers
  const assigned = await fetchCenterIdsForCourse(doc._id);
  const isGlobal = assigned.length === 0;

  if (isGlobal && actor.role !== "superadmin") {
    return res.status(403).json({ ok: false, message: "Cannot delete global course" });
  }

const actorId = String(actor._id || actor.sub);
const actorOrgId = String(actor.orgId);

const isOwner =
  String(doc.createdById) === actorId;

const isAssignedTeacher =
  Array.isArray(doc.centerTeacherAssignments) &&
  doc.centerTeacherAssignments.some(
    (x) =>
      String(x.centerId) === actorOrgId &&
      (String(x.teacherId) === actorId ||
       (Array.isArray(x.teacherIds) && x.teacherIds.some(id => String(id) === actorId)))
  );

if (
  !isOwner &&
  !isAssignedTeacher &&
  actor.role !== "superadmin"
) {
  return res.status(403).json({
    ok: false,
    message: "Not allowed"
  });
}

  await Course.deleteOne({ _id: id });
  return res.json({ ok: true });
}

// POST /courses/bulk-upsert
export async function bulkUpsert(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  let created = 0, updated = 0;

  for (const r of rows) {
    try {
      const title = String(r.title || "").trim();
      if (!title) continue;

      const slug = r.slug ? String(r.slug).trim().toLowerCase() : undefined;

      const patch = {
        title,
        slug,
        description: r.description || null,
        category: r.category || null,
        programType: r.programType || null,
        price: Number.isFinite(Number(r.price))
          ? Math.round(Number(r.price))
          : 0,
        visibility: ["public", "private", "unlisted"].includes(String(r.visibility || "").toLowerCase())
          ? String(r.visibility).toLowerCase()
          : "unlisted",
        status: ["draft", "published", "archived"].includes(String(r.status || "").toLowerCase())
          ? String(r.status).toLowerCase()
          : "draft",
        tags: Array.isArray(r.tags)
          ? r.tags
          : (typeof r.tags === "string"
            ? String(r.tags)
              .split(/[|;,]/)
              .map((s) => s.trim())
              .filter(Boolean)
            : []),
        isBundled: !!r.isBundled,
        chapters: Array.isArray(r.chapters) ? r.chapters : [],
        demoVideoUrl: r.demoVideoUrl || null,

        // NEW bundle-level fields
        discountPercent: Number.isFinite(Number(r?.discountPercent)) ? clampDiscount(Number(r.discountPercent)) : 0,
        level: r?.level ? String(r.level).toLowerCase() : "all",
        bundleCoverUrl: r?.bundleCoverUrl || null,
        platformFee: Number.isFinite(Number(r?.platformFee)) ? Number(r.platformFee) : getPlatformFeePaise(),
        courseType: String(r.courseType || r.type || "paid").toLowerCase() === "free" ? "free" : "paid",
        durationText: typeof r.durationText === "string"
          ? r.durationText
          : (typeof r.duration === "string" ? r.duration : ""),
      };

      // teacher: accept teacherId OR teacherEmail in CSV (same org) 
      if (r.teacherId) {
        patch.teacherId = r.teacherId;
      } else if (r.teacherEmail) {
        const t = await User.findOne({
          email: String(r.teacherEmail).toLowerCase(),
          orgId: actor.orgId,
          role: "teacher",
        }).select("_id");
        patch.teacherId = t ? t._id : null;
      }

      let doc = await Course.findOne({ orgId: actor.orgId, slug });
      if (doc) {
        await Course.updateOne({ _id: doc._id }, { $set: patch });
        updated++;
      } else {
        await Course.create({
          ...patch,
          orgId: actor.orgId,
          ownerId: (actor.role === "teacher") ? (actor.managerId || null) : (actor._id || actor.sub || null),
          createdById: actor._id || actor.sub,
          managerId: (actor.role === "teacher") ? (actor.managerId || null) : null,
        });
        created++;
      }
    } catch {
      // skip bad row
    }
  }
  return res.json({ created, updated, total: created + updated });
}
