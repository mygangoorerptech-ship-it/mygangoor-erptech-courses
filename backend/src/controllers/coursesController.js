// backend/src/controllers/coursesController.js
import Course from "../models/Course.js";
import User from "../models/User.js";
import { getPlatformFeePaise } from "../config/platform.js";

function clampDiscount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return Math.round(x);
}

function sanitize(doc) {
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
    price: o.price ?? 0,
    visibility: o.visibility || "unlisted",
    status: o.status || "draft",
    orgId: o.orgId ? String(o.orgId) : null,
    ownerId: o.ownerId ? String(o.ownerId) : null,
    createdById: o.createdById ? String(o.createdById) : null,
    courseType: o.courseType || "paid", 
    durationText: o.durationText || "", 
    teacherId: o.teacherId ? String(o.teacherId) : null,
    isBundled: !!o.isBundled,
    chapters: Array.isArray(o.chapters) ? o.chapters : [],
    demoVideoUrl: o.demoVideoUrl || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    tags: Array.isArray(o.tags) ? o.tags : [],

    // NEW bundle-level fields
    discountPercent: Number.isFinite(o.discountPercent) ? clampDiscount(o.discountPercent) : 0,
    level: o.level || "all",
    bundleCoverUrl: o.bundleCoverUrl || null,
    platformFee: Number.isFinite(o.platformFee) ? o.platformFee : 0,

    // computed helpers (paise)
    priceAfterDiscount,
    totalWithFees,
  };
}

// GET /courses  (admin + vendor + student read within org)
export async function list(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const { q, status = "all", page, limit } = req.query || {};
  const and = [{ orgId: actor.orgId }];

  if (q) {
    const rx = { $regex: String(q), $options: "i" };
    and.push({ $or: [{ title: rx }, { slug: rx }, { category: rx }, { description: rx }, { tags: rx }] });
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
    return res.json({ items: docs.map(sanitize), total, page: p, pageSize: sz });
  }
  // Legacy non-paginated
  const docs = await Course.find(where).sort({ createdAt: -1 });
  return res.json(docs.map(sanitize));
}

// POST /courses
export async function create(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const {
    title, slug, description, category, price, visibility, status, tags, 
    isBundled, chapters, demoVideoUrl, 
    // NEW 
    courseType, durationText, teacherId,
    // NEW bundle-level fields
    discountPercent, level, bundleCoverUrl, platformFee,
  } = req.body || {};

  if (!title) return res.status(400).json({ ok: false, message: "title required" });

    let teacherObjectId = null; 
  if (teacherId) { 
    // Verify teacher belongs to same org and is a vendor (treated as teacher) 
    const teacher = await User.findOne({ _id: teacherId, orgId: actor.orgId, role: "vendor" }).select("_id"); 
    teacherObjectId = teacher ? teacher._id : null; 
  }

  const payload = {
    title,
    slug,
    description,
    category,
    price: Number.isFinite(price) ? price : 0,
    visibility: visibility || "unlisted",
    status: status || "draft",
    orgId: actor.orgId,

    // Ownership: ownerId = admin for attribution, createdById = who actually created (admin or vendor)
    ownerId: actor.role === "vendor" ? (actor.managerId || null) : (actor._id || actor.sub || null),
    createdById: actor._id || actor.sub,
    managerId: actor.role === "vendor" ? (actor.managerId || null) : null,

    courseType: (courseType === "free" ? "free" : "paid"), 
    durationText: typeof durationText === "string" ? durationText : "", 
    teacherId: teacherObjectId,

    isBundled: !!isBundled,
    chapters: Array.isArray(chapters) ? chapters : [],
    demoVideoUrl: demoVideoUrl || null,

    tags: Array.isArray(tags)
      ? tags
      : (typeof tags === "string"
          ? String(tags).split(",").map((s) => s.trim()).filter(Boolean)
          : []),

    // NEW bundle-level fields (validated)
    discountPercent: Number.isFinite(discountPercent) ? clampDiscount(discountPercent) : 0,
    level: (level || "all").toLowerCase(),
    bundleCoverUrl: bundleCoverUrl || null,
    platformFee: Number.isFinite(platformFee) ? platformFee : getPlatformFeePaise(),
  };

  const doc = await Course.create(payload);
  return res.json(sanitize(doc));
}

// PATCH /courses/:id  (edit only if you created it)
export async function patch(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok: false });

  const { id } = req.params;

  const baseAllow = [
    "title", "slug", "description", "category", "price",
    "visibility", "status", "tags", "isBundled", "chapters", "demoVideoUrl",
    "courseType", "durationText", "teacherId",
  ];

  const patch = {};
  // allow base fields
  for (const k of baseAllow) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, k)) {
        if (k === "courseType") patch[k] = (req.body[k] === "free" ? "free" : "paid"); 
      else patch[k] = req.body[k];
    }
  }

  // Validate teacherId if provided 
  if (patch.teacherId) { 
    const v = await User.findOne({ _id: patch.teacherId, orgId: actor.orgId, role: "vendor" }).select("_id"); 
    patch.teacherId = v ? v._id : null; 
  }
  // allow NEW bundle-level fields with validation
  if (Number.isFinite(req.body?.discountPercent)) {
    patch.discountPercent = clampDiscount(req.body.discountPercent);
  }
  if (typeof req.body?.level === "string") {
    patch.level = String(req.body.level).toLowerCase();
  }
  if (typeof req.body?.bundleCoverUrl === "string") {
    patch.bundleCoverUrl = req.body.bundleCoverUrl;
  }
  if (Number.isFinite(req.body?.platformFee)) {
    patch.platformFee = req.body.platformFee;
  }

  const doc = await Course.findOne({ _id: id, orgId: actor.orgId });
  if (!doc) return res.status(404).json({ ok: false });

  const isOwner = String(doc.createdById) === String(actor._id || actor.sub);
  if (!isOwner && actor.role !== "superadmin") {
    return res.status(403).json({ ok: false, message: "Not allowed" });
  }

  const updated = await Course.findByIdAndUpdate(id, { $set: patch }, { new: true });
  return res.json(sanitize(updated));
}

// POST /courses/:id/status
export async function setStatus(req, res) {
  const actor = req.user;
  const { id } = req.params;
  const { status } = req.body || {};
  const doc = await Course.findOne({ _id: id, orgId: actor.orgId });
  if (!doc) return res.status(404).json({ ok: false });

  const isOwner = String(doc.createdById) === String(actor._id || actor.sub);
  if (!isOwner && actor.role !== "superadmin") {
    return res.status(403).json({ ok: false, message: "Not allowed" });
  }

  const next = await Course.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  return res.json(sanitize(next));
}

// DELETE /courses/:id
export async function remove(req, res) {
  const actor = req.user;
  const { id } = req.params;

  const doc = await Course.findOne({ _id: id, orgId: actor.orgId });
  if (!doc) return res.status(404).json({ ok: false });

  // SA/global course cannot be deleted by org admins/vendors
  if (!doc.orgId && actor.role !== "superadmin") {
    return res.status(403).json({ ok: false, message: "Cannot delete global course" });
  }

  const isOwner = String(doc.createdById) === String(actor._id || actor.sub);
  if (!isOwner && actor.role !== "superadmin") {
    return res.status(403).json({ ok: false, message: "Not allowed" });
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
        price: Number.isFinite(r.price) ? r.price : 0,
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
        discountPercent: Number.isFinite(r?.discountPercent) ? clampDiscount(r.discountPercent) : 0,
        level: r?.level ? String(r.level).toLowerCase() : "all",
        bundleCoverUrl: r?.bundleCoverUrl || null,
        platformFee: Number.isFinite(r?.platformFee) ? r.platformFee : getPlatformFeePaise(),
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
          role: "vendor", 
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
          ownerId: actor.role === "vendor" ? (actor.managerId || null) : (actor._id || actor.sub || null),
          createdById: actor._id || actor.sub,
          managerId: actor.role === "vendor" ? (actor.managerId || null) : null,
        });
        created++;
      }
    } catch {
      // skip bad row
    }
  }
  return res.json({ created, updated, total: created + updated });
}
