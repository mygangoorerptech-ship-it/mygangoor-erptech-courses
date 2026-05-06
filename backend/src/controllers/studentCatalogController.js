// backend/src/controllers/studentCatalogController.js (inside backend1.zip)
import Course from "../models/Course.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import mongoose from "mongoose";
import CourseAssignment from "../models/CourseAssignment.js";

// helper: parse simple "3h 20m" / "95m" → hours number
function parseDurationTextToHours(input) {
  if (!input || typeof input !== "string") return 0;
  const s = input.trim().toLowerCase();
  const hMatch = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const mMatch = s.match(/(\d+(?:\.\d+)?)\s*m/);
  const h = hMatch ? parseFloat(hMatch[1]) : 0;
  const m = mMatch ? parseFloat(mMatch[1]) : 0;
  if (h || m) return Math.max(0, Math.round((h + m / 60) * 1) / 1);
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 0) return Math.max(0, Math.round((asNum / 60) * 1) / 1);
  return 0;
}

export async function listCourses(req, res) {
  try {
    // Optional debug — set DEBUG_CATALOG=1 to enable; silent in production
    if (process.env.DEBUG_CATALOG === "1") {
      try {
        console.log(
          "[studentCatalog.listCourses]",
          "role:", req.user?.role,
          "roles:", req.user?.roles,
          "orgId(jwt):", req.user?.orgId
        );
      } catch { }
    }

    // All published courses — visible to everyone (public + org + global) regardless of org membership
    const query = { status: { $in: ["published", "Published"] } };

    const docs = await Course.find(query)
      .select(
        [
          "_id", "title", "slug", "description", "category", "tags",
          "coverUrl", "bundleCoverUrl", "demoVideoUrl",
          "price", "discountPercent", "ratingAvg", "ratingCount",
          "level", "orgId", "ownerId", "visibility", "status",
          "duration", "durationHours", "createdAt", "updatedAt",
        ].join(" ")
      )
      .sort({ createdAt: -1 })
      .lean();

    // ── fetch center assignments ─────────────────────────────
    const courseIds = docs.map(c => c._id);

    const assignments = courseIds.length
      ? await CourseAssignment.find({ courseId: { $in: courseIds } }).lean()
      : [];

    const centerMap = new Map();

    for (const a of assignments) {
      const key = String(a.courseId);
      if (!centerMap.has(key)) {
        centerMap.set(key, { ids: [], names: [] });
      }
      const id = String(a.centerId);
      const entry = centerMap.get(key);

      if (!entry.ids.includes(id)) {
        entry.ids.push(id);
      }
    }

    // Bulk-fetch org names for all courses that have an orgId
    const orgIds = [...new Set(docs.map(c => c.orgId).filter(Boolean).map(String))];
    const orgNameMap = new Map();
    if (orgIds.length) {
      const orgs = await Organization.find({ _id: { $in: orgIds } }).select("_id name").lean();
      for (const o of orgs) orgNameMap.set(String(o._id), o.name || null);
    }

    // ── fetch center names ─────────────────────────────
    const allCenterIds = assignments.length
      ? [...new Set(assignments.map(a => String(a.centerId)))]
      : [];

    const centerNameMap = new Map();

    if (allCenterIds.length) {
      const orgs = await Organization.find({
        _id: { $in: allCenterIds }
      }).select("_id name").lean();

      for (const o of orgs) {
        centerNameMap.set(String(o._id), o.name);
      }
    }

    // attach names
    for (const [courseId, data] of centerMap.entries()) {
      data.names = data.ids.map(id => centerNameMap.get(id) || "Unknown");
    }

    const items = docs.map((c) => {
      const cm = centerMap.get(String(c._id)) || { ids: [], names: [] };
      // ---- pricing in paise (authoritative) ----
      const pricePaiseRaw = Number.isFinite(c.price) ? Number(c.price) : 0;
      const discountPercent = Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0;

      const mrpPaise =
        pricePaiseRaw > 0 ? pricePaiseRaw : null;

      const salePaise =
        mrpPaise != null && discountPercent > 0
          ? Math.max(0, Math.round(mrpPaise * (1 - discountPercent / 100)))
          : mrpPaise;

      return {
        id: String(c._id),
        title: c.title || "",
        slug: c.slug || null,
        description: c.description || "",
        category: c.category || null,
        tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
        cover: c.bundleCoverUrl || c.coverUrl || null,
        previewUrl: c.demoVideoUrl || null,

        // back-compat (paise)
        price: mrpPaise,
        // authoritative (paise)
        pricePaise: mrpPaise,
        // handy extras (paise)
        mrpPaise,
        salePaise,

        discountPercent,
        discount: discountPercent, // legacy alias

        rating: Number.isFinite(c.ratingAvg) ? Number(c.ratingAvg) : 0,
        ratingCount: Number.isFinite(c.ratingCount) ? Number(c.ratingCount) : 0,

        level: c.level || "all",
        visibility: c.visibility || "unlisted",
        status: c.status || "draft",

        orgId: c.orgId ? String(c.orgId) : null,
        orgName: c.orgId ? (orgNameMap.get(String(c.orgId)) ?? null) : null,
        centerIds: cm.ids,
        centerNames: cm.names,
        ownerId: c.ownerId ? String(c.ownerId) : null,

        duration: c.duration || null,
        durationHours: Number.isFinite(c.durationHours) ? Number(c.durationHours) : undefined,

        createdAt: c.createdAt || null,
        updatedAt: c.updatedAt || null,
      };
    });

    return res.json(items);
  } catch (e) {
    console.error("[students/courses] error:", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

// NEW: minimal “cards” payload for Tracks page
export async function listCatalogCards(req, res) {
  try {
    // pagination
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 12;
    const cursor = (req.query.cursor || "").toString().trim();

    // All published public courses — visible to every user regardless of org membership
    const query = { status: { $in: ["published", "Published"] } };
    if (cursor && mongoose.isValidObjectId(cursor)) {
      // efficient keyset pagination by _id (newest first)
      Object.assign(query, { _id: { $lt: new mongoose.Types.ObjectId(cursor) } });
    }

    const docs = await Course.find(query)
      .select(
        [
          "_id",
          "title",
          "slug",
          "description",
          "category",
          "tags",
          "coverUrl",
          "bundleCoverUrl",
          "demoVideoUrl",
          "price",
          "discountPercent",
          "ratingAvg",
          "ratingCount",
          "level",
          "orgId",
          "visibility",
          "status",
          "durationText",           // ← include for fallback parsing
          "chapters.durationSeconds"// ← include to compute real duration
        ].join(" ")
      )
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    // ── fetch center assignments ─────────────────────────────
    const cardCourseIds = docs.map(c => c._id);

    const cardAssignments = cardCourseIds.length
      ? await CourseAssignment.find({ courseId: { $in: cardCourseIds } }).lean()
      : [];

    const cardCenterMap = new Map();

    for (const a of cardAssignments) {
      const key = String(a.courseId);
      if (!cardCenterMap.has(key)) {
        cardCenterMap.set(key, { ids: [], names: [] });
      }
      const id = String(a.centerId);
      const entry = cardCenterMap.get(key);

      if (!entry.ids.includes(id)) {
        entry.ids.push(id);
      }
    }

    // Bulk-fetch org names
    const cardOrgIds = [...new Set(docs.map(c => c.orgId).filter(Boolean).map(String))];
    const cardOrgNameMap = new Map();
    if (cardOrgIds.length) {
      const orgs = await Organization.find({ _id: { $in: cardOrgIds } }).select("_id name").lean();
      for (const o of orgs) cardOrgNameMap.set(String(o._id), o.name || null);
    }

    // ── center names ─────────────────────────────
    const cardCenterIds = cardAssignments.length
      ? [...new Set(cardAssignments.map(a => String(a.centerId)))]
      : [];

    const cardCenterNameMap = new Map();

    if (cardCenterIds.length) {
      const orgs = await Organization.find({
        _id: { $in: cardCenterIds }
      }).select("_id name").lean();

      for (const o of orgs) {
        cardCenterNameMap.set(String(o._id), o.name);
      }
    }

    for (const [courseId, data] of cardCenterMap.entries()) {
      data.names = data.ids.length
        ? data.ids.map(id => cardCenterNameMap.get(id) || "Unknown")
        : [];
    }

    const items = docs.slice(0, limit).map((c) => {
      const cm = cardCenterMap.get(String(c._id)) || { ids: [], names: [] };
      // compute total seconds from chapters; fallback to durationText
      const chapters = Array.isArray(c.chapters) ? c.chapters : [];
      const totalSeconds = chapters.reduce((s, ch) => s + (Number(ch.durationSeconds) || 0), 0);

      let durationHours = 0;
      if (totalSeconds > 0) {
        durationHours = Math.max(0, Math.round((totalSeconds / 3600) * 1) / 1); // integer hours; adjust if needed
        durationHours = Math.round(durationHours); // ensure clean "xh" display
      } else {
        durationHours = parseDurationTextToHours(c.durationText || "");
      }

      return {
        id: String(c._id),
        title: c.title || "",
        slug: c.slug || null,
        description: c.description || "",
        category: c.category || null,
        tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
        cover: c.bundleCoverUrl || c.coverUrl || null,
        previewUrl: c.demoVideoUrl || null,
        price: Number.isFinite(c.price) ? Number(c.price) : null,
        pricePaise: Number.isFinite(c.price) ? Number(c.price) : null,
        discountPercent: Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0,
        // Optional alias, helps if any UI still reads `discount`
        discount: Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0,
        rating: Number.isFinite(c.ratingAvg) ? Number(c.ratingAvg) : 0,
        ratingCount: Number.isFinite(c.ratingCount) ? Number(c.ratingCount) : 0,
        orgId: c.orgId ? String(c.orgId) : null,
        orgName: c.orgId ? (cardOrgNameMap.get(String(c.orgId)) ?? null) : null,
        visibility: c.visibility || "unlisted",
        status: c.status || "draft",
        level: c.level || "all",

        // ✅ new: numeric hours for card UI; guaranteed number; falls back to 0
        durationHours: Number.isFinite(durationHours) ? durationHours : 0,
        // (optional) also send durationText if you ever want to show it:
        durationText: c.durationText || null,
        centerIds: cm.ids,
        centerNames: cm.names,
      };
    });

    const hasMore = docs.length > limit;
    const lastReturned = items.length ? items[items.length - 1] : null;
    const nextCursor = hasMore && lastReturned ? String(lastReturned.id) : null;

    return res.json({ items, nextCursor });
  } catch (e) {
    console.error("[studentCatalog.listCatalogCards] error:", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

export async function getCourseDetail(req, res) {
  try {
    const { id } = req.params;
    const actor = req.user;

    // rehydrate orgId if missing on token
    let orgId = actor?.orgId || null;
    if (!orgId && actor?.sub) {
      const u = await User.findById(actor.sub).select("orgId").lean();
      if (u?.orgId) orgId = u.orgId;
    }

    // allow any published public course — mirrors catalog-level visibility rule
    const c = await Course.findOne({ _id: id, status: { $in: ["published", "Published"] } }).lean();
    if (!c) return res.status(404).json({ ok: false, message: "Course not found" });

    // 🔹 NEW: resolve instructor/owner names
    const pickName = (u) =>
      u?.name || u?.fullName || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.displayName || null;

    let ownerName = null, teacherName = null;
    const ids = [];
    if (c.ownerId) ids.push(String(c.ownerId));
    if (c.teacherId) ids.push(String(c.teacherId));
    if (ids.length) {
      const users = await User.find({ _id: { $in: ids } })
        .select("name fullName firstName lastName displayName")
        .lean();
      const byId = new Map(users.map(u => [String(u._id), u]));
      if (c.ownerId && byId.has(String(c.ownerId))) ownerName = pickName(byId.get(String(c.ownerId)));
      if (c.teacherId && byId.has(String(c.teacherId))) teacherName = pickName(byId.get(String(c.teacherId)));
    }

    const chapters = Array.isArray(c.chapters) ? c.chapters : [];
    const totalSeconds = chapters.reduce((s, ch) => s + (Number(ch.durationSeconds) || 0), 0);
    const formatHMS = s => {
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return h ? `${h}h ${m}m` : `${m}m`;
    };

    // Use ratingAvg and ratingCount stored on the course, defaulting to 0
    const ratingAvg = Number(c.ratingAvg) || 0;
    const ratingCount = Number(c.ratingCount) || 0;

    const assignments = await CourseAssignment.find({
      courseId: c._id
    }).select("centerId").lean();

    const centerIds = assignments.map(a => String(a.centerId));

    let centerNames = [];

    if (centerIds.length) {
      const orgs = await Organization.find({
        _id: { $in: centerIds }
      }).select("name").lean();

      const nameMap = new Map(orgs.map(o => [String(o._id), o.name]));
      centerNames = centerIds.map(id => nameMap.get(id) || "Unknown");
    }

    return res.json({
      id: String(c._id),
      title: c.title,
      slug: c.slug || null,
      category: c.category || null,
      description: c.description || null,
      duration: (c.durationText && c.durationText.trim()) || (totalSeconds ? formatHMS(totalSeconds) : "—"),
      level: c.level || "all",
      tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
      cover: c.bundleCoverUrl || c.coverUrl || null,
      rating: ratingAvg,
      reviews: ratingCount,
      // 🔹 NEW fields
      teacherId: c.teacherId ? String(c.teacherId) : null,
      teacherName: teacherName,
      ownerName: ownerName,
      chapters: chapters
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
        .map(ch => ({
          id: ch._id ? String(ch._id) : undefined,
          title: ch.title,
          description: ch.description || ch.subtitle || null,
          coverUrl: ch.coverUrl || null,
          videoUrl: ch.videoUrl || null,
          youtubeUrl: ch.youtubeUrl || null,
          durationSeconds: Number(ch.durationSeconds) || 0,
        })),
      centerIds,
      centerNames,
    });
  } catch (e) {
    console.error("[studentCatalog.getCourseDetail] error:", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}