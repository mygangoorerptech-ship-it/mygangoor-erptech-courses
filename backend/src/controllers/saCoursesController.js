// backend/src/controllers/saCoursesController.js
import Course from "../models/Course.js";
import { getPlatformFeePaise } from "../config/platform.js";
import User from "../models/User.js";
import mongoose from "mongoose"

const HEX24 = /^[0-9a-fA-F]{24}$/;

/** Normalize orgId coming from querystring/body; tolerant to junk and objects */
function normalizeOrgId(input) {
  if (input === undefined || input === null || input === "" || input === "global") return null;
  let v = input;
  if (typeof v === "object") {
    if (v.value) v = v.value;
    else if (v._id) v = v._id;
    else if (v.$oid) v = v.$oid;
    else if (v.id) v = v.id;
  }
  const s = String(v);
  if (s === "[object Object]") return null;
  return HEX24.test(s) ? s : null;
}

/** Safely extract an id from a populated doc or raw value */
const idOf = (v) => (v && typeof v === "object" && v._id ? v._id : v);

function clampDiscount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}

function sanitize(doc) {
  if (!doc) return doc;
  const o = doc.toObject ? doc.toObject() : doc;

  const price = Number.isFinite(o.price) ? o.price : 0;
  const d = Number.isFinite(o.discountPercent) ? clampDiscount(o.discountPercent) : 0;
  const priceAfterDiscount = Math.max(0, Math.round(price * (100 - d) / 100));
  const fee = Number.isFinite(o.platformFee) ? o.platformFee : 0;
  const totalWithFees = priceAfterDiscount + (fee >= 0 ? fee : 0);

  const orgId = o.orgId ? String(idOf(o.orgId)) : null;
  const ownerId = o.ownerId ? String(idOf(o.ownerId)) : null;
  const teacherId = o.teacherId ? String(idOf(o.teacherId)) : null;
  const createdById = o.createdById ? String(idOf(o.createdById)) : null;

  return {
    id: String(o._id),
    title: o.title,
    slug: o.slug || null,
    description: o.description || null,
    category: o.category || null,
    programType: o.programType || null,
    courseType: o.courseType || "paid",
    durationText: o.durationText || "",
    teacherId,
    price: o.price ?? 0,
    visibility: o.visibility || "unlisted",
    status: o.status || "draft",
    orgId,
    ownerId,
    tags: Array.isArray(o.tags) ? o.tags : [],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,

    // prefer denormalized fields; else try populated fallbacks
    orgName: o.orgName || o.org?.name || o.orgId?.name || null,
    ownerName: o.ownerName || o.owner?.name || o.ownerId?.name || null,
    ownerEmail: o.ownerEmail || o.owner?.email || o.ownerId?.email || null,

    // NEW fields already in your schema
    isBundled: !!o.isBundled,
    chapters: Array.isArray(o.chapters) ? o.chapters : [],
    demoVideoUrl: o.demoVideoUrl || null,
    createdById,

    // NEW bundle-level fields + computed totals
    discountPercent: Number.isFinite(o.discountPercent) ? clampDiscount(o.discountPercent) : 0,
    level: o.level || "all",
    bundleCoverUrl: o.bundleCoverUrl || null,
    platformFee: Number.isFinite(o.platformFee) ? o.platformFee : 0,
    priceAfterDiscount,
    totalWithFees,
  };
}

// GET /sa/courses
export async function list(req, res) {
  const { q, status = "all", orgId, ownerEmail, page, limit } = req.query || {};
  const and = [];

  if (q) {
    const rx = { $regex: String(q), $options: "i" };
    and.push({ $or: [{ title: rx }, { slug: rx }, { category: rx }, { programType: rx }, { description: rx }, { tags: rx }] });
  }
  if (status !== "all") and.push({ status });

  // ✅ use tolerant normalization for org filter
// Apply org filter ONLY if explicitly provided
if (orgId !== undefined) {
  const oid = normalizeOrgId(orgId);

  if (oid === null) {
    // explicit "global"
    and.push({ orgId: null });
  } else if (oid) {
    // specific org
    and.push({ orgId: oid });
  }
}

  if (ownerEmail) {
    const owner = await User.findOne({ email: String(ownerEmail).toLowerCase() }).select("_id");
    if (owner) and.push({ ownerId: owner._id });
    else return res.json([]); // keep your legacy behavior
  }

  const where = and.length ? { $and: and } : {};

  // If page/limit present -> paginated response; else keep legacy array
  if (page !== undefined || limit !== undefined) {
    const p = Math.max(1, Number(page) || 1);
    const sz = Math.min(10, Math.max(1, Number(limit) || 10)); // cap at 10
    const total = await Course.countDocuments(where);
    const docs = await Course.find(where)
      .sort({ createdAt: -1 })
      .skip((p - 1) * sz)
      .limit(sz)
      .populate("ownerId", "name email")
      .populate("teacherId", "name email")
      .populate("orgId", "name")
      .lean();

    const items = docs.map((d) => ({
      ...sanitize(d),
      ownerName: d.ownerId?.name || null,
      ownerEmail: d.ownerId?.email || null,
      teacherName: d.teacherId?.name || null,
      teacherEmail: d.teacherId?.email || null,
      orgName: d.orgId?.name || null,
    }));
    return res.json({ items, total, page: p, pageSize: sz });
  }

  // Legacy non-paginated mode
  const docs = await Course.find(where)
    .populate("ownerId", "name email")
    .populate("teacherId", "name email")
    .populate("orgId", "name")
    .sort({ createdAt: -1 })
    .lean();

  const rows = [];
  for (const d of docs) {
    rows.push({
      ...sanitize(d),
      ownerName: d.ownerId?.name || null,
      ownerEmail: d.ownerId?.email || null,
      teacherName: d.teacherId?.name || null,
      teacherEmail: d.teacherId?.email || null,
      orgName: d.orgId?.name || null,
    });
  }
  return res.json(rows);
}

// POST /sa/courses
export async function create(req, res) {
  const {
    title, slug, description, category, programType,
    price, visibility, status, orgId, ownerEmail, tags,
    // NEW
    isBundled, chapters, demoVideoUrl,
    courseType, durationText, teacherId, teacherEmail,
    // NEW bundle-level fields
    discountPercent, level, bundleCoverUrl, platformFee,
  } = req.body || {};
  if (!title) return res.status(400).json({ ok: false, message: "title required" });
  if (!programType) return res.status(400).json({ ok: false, message: "programType required" });

  let ownerId = null;
  if (ownerEmail) {
    const owner = await User.findOne({ email: String(ownerEmail).toLowerCase() });
    if (owner) ownerId = owner._id;
  }

  // teacher can be provided by id or email; must match the same org (if orgId is provided)
  let teacherObjectId = null;
  if (teacherId) {
    const t = await User.findOne({ _id: teacherId }).select("_id orgId role");
    if (t && (!orgId || String(t.orgId) === String(orgId)) && t.role === "teacher") {
      teacherObjectId = t._id;
    }
  } else if (teacherEmail) {
    const t = await User.findOne({ email: String(teacherEmail).toLowerCase(), role: "teacher" })
      .select("_id orgId");
    if (t && (!orgId || String(t.orgId) === String(orgId))) {
      teacherObjectId = t._id;
    }
  }

  const numericPrice = Number(price);
  const pricePaise = Number.isFinite(numericPrice) ? Math.round(numericPrice) : 0;

  const doc = await Course.create({
    title,
    slug,
    description,
    category,
    programType,
    courseType: (courseType === "free" ? "free" : "paid"),
    durationText: typeof durationText === "string" ? durationText : "",
    teacherId: teacherObjectId,
    price: pricePaise,
    visibility: visibility || "unlisted",
    status: status || "draft",
    orgId: normalizeOrgId(orgId), // ✅ tolerant
    ownerId,
    tags: Array.isArray(tags)
      ? tags
      : (typeof tags === "string" ? String(tags).split(",").map((s) => s.trim()).filter(Boolean) : []),
    createdById: req.user?._id || req.user?.sub,

    // NEW fields
    isBundled: !!isBundled,
    chapters: Array.isArray(chapters) ? chapters : [],
    demoVideoUrl: demoVideoUrl || null,

    // NEW bundle-level
    discountPercent: Number.isFinite(discountPercent) ? clampDiscount(discountPercent) : 0,
    level: (level || "all").toLowerCase(),
    bundleCoverUrl: bundleCoverUrl || null,
    platformFee: Number.isFinite(platformFee) ? platformFee : getPlatformFeePaise(),
  });

  return res.json(sanitize(doc));
}

// PATCH /sa/courses/:id
export async function patch(req, res) {
  const { id } = req.params;

  const p = {};
  const pick = [
    "title", "slug", "description", "category", "programType",
    "price", "visibility", "status", "orgId", "tags",
    // NEW fields
    "isBundled", "chapters", "demoVideoUrl",
    "courseType", "durationText", "teacherId",
  ];
  for (const k of pick) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, k))
      p[k] = (k === "courseType" ? (req.body[k] === "free" ? "free" : "paid") : req.body[k]);
  }

  // optional teacherEmail mapping
  if (req.body?.teacherEmail) {
    const t = await User.findOne({ email: String(req.body.teacherEmail).toLowerCase(), role: "teacher" })
      .select("_id");
    p.teacherId = t ? t._id : null;
  }

  // validate teacherId if provided directly
  if (p.teacherId) {
    const t = await User.findOne({ _id: p.teacherId, role: "teacher" }).select("_id");
    p.teacherId = t ? t._id : null;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, "orgId")) {
    p.orgId = normalizeOrgId(req.body.orgId); // ✅ tolerant
  }

  // normalize
  if ("price" in p) {
    const np = Number(p.price);
    p.price = Number.isFinite(np) ? Math.round(np) : 0;
  }
  if ("tags" in p) {
    p.tags = Array.isArray(p.tags)
      ? p.tags
      : (typeof p.tags === "string"
          ? String(p.tags).split(",").map((s) => s.trim()).filter(Boolean)
          : []);
  }
  if ("chapters" in p && !Array.isArray(p.chapters)) {
    p.chapters = [];
  }
  if ("isBundled" in p) p.isBundled = !!p.isBundled;

  // owner by email (optional)
  if (Object.prototype.hasOwnProperty.call(req.body || {}, "ownerEmail")) {
    const owner = await User.findOne({ email: String(req.body.ownerEmail).toLowerCase() });
    p.ownerId = owner ? owner._id : null;
  }

  // NEW bundle-level fields (validated)
  if (Number.isFinite(req.body?.discountPercent)) {
    p.discountPercent = clampDiscount(req.body.discountPercent);
  }
  if (typeof req.body?.level === "string") {
    p.level = String(req.body.level).toLowerCase();
  }
  if (typeof req.body?.bundleCoverUrl === "string") {
    p.bundleCoverUrl = req.body.bundleCoverUrl;
  }
  if (Number.isFinite(req.body?.platformFee)) {
    p.platformFee = req.body.platformFee;
  }

  const doc = await Course.findByIdAndUpdate(id, { $set: p }, { new: true })
    .populate("ownerId", "name email")
    .populate("teacherId", "name email")
    .populate("orgId", "name");
  if (!doc) return res.status(404).json({ ok: false });

  const o = sanitize(doc);
  o.ownerName = doc.ownerId?.name || null;
  o.ownerEmail = doc.ownerId?.email || null;
  o.teacherName = doc.teacherId?.name || null;
  o.teacherEmail = doc.teacherId?.email || null;
  o.orgName = doc.orgId?.name || null;
  return res.json(o);
}

// POST /sa/courses/:id/status
export async function setStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!["draft", "published", "archived"].includes(status)) {
    return res.status(400).json({ ok: false });
  }
  const doc = await Course.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!doc) return res.status(404).json({ ok: false });
  return res.json(sanitize(doc));
}

// DELETE /sa/courses/:id
export async function remove(req, res) {
  const { id } = req.params;
  await Course.deleteOne({ _id: id });
  return res.json({ ok: true });
}

// POST /sa/courses/bulk-upsert  (superadmin)
export async function bulkUpsert(req, res) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  let created = 0, updated = 0;

  for (const r of rows) {
    try {
      const title = String(r.title || "").trim();
      if (!title) continue;

      const slug = r.slug ? String(r.slug).trim().toLowerCase() : undefined;
      const orgId = normalizeOrgId(r.orgId); // ✅ tolerant

      let ownerId = null;
      if (r.ownerEmail) {
        const owner = await User.findOne({ email: String(r.ownerEmail).toLowerCase() }).select("_id");
        ownerId = owner ? owner._id : null;
      }

      const priceNum = Number(r.price);
      const patch = {
        title,
        slug,
        description: r.description || null,
        category: r.category || null,
        programType: r.programType || null,
        courseType: String(r.courseType || r.type || "paid").toLowerCase() === "free" ? "free" : "paid",
        durationText: typeof r.durationText === "string"
          ? r.durationText
          : (typeof r.duration === "string" ? r.duration : ""),
        price: Number.isFinite(priceNum) ? Math.round(priceNum) : 0,
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
        orgId,
        ownerId,

        // NEW fields
        isBundled: !!r.isBundled,
        chapters: Array.isArray(r.chapters) ? r.chapters : [],
        demoVideoUrl: r.demoVideoUrl || null,

        // NEW bundle-level
        discountPercent: Number.isFinite(r?.discountPercent) ? clampDiscount(r.discountPercent) : 0,
        level: r?.level ? String(r.level).toLowerCase() : "all",
        bundleCoverUrl: r?.bundleCoverUrl || null,
        platformFee: Number.isFinite(r?.platformFee) ? r.platformFee : getPlatformFeePaise(),
      };

      // teacher via id/email; must match same org if specified
      if (r.teacherId) {
        patch.teacherId = r.teacherId;
      } else if (r.teacherEmail) {
        const t = await User.findOne({
          email: String(r.teacherEmail).toLowerCase(),
          role: "teacher",
          ...(orgId ? { orgId } : {}),
        }).select("_id");
        patch.teacherId = t ? t._id : null;
      }

      const criteria = {};
      if (slug) criteria.slug = slug;
      criteria.orgId = orgId === null ? null : orgId;

      let doc = slug ? await Course.findOne(criteria) : null;
      if (doc) {
        await Course.updateOne({ _id: doc._id }, { $set: patch });
        updated++;
      } else {
        await Course.create({ ...patch, createdById: req.user?._id || req.user?.sub });
        created++;
      }
    } catch {
      /* ignore malformed row */
    }
  }

  return res.json({ created, updated, total: created + updated });
}
