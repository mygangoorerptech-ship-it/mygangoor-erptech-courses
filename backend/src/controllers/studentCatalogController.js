// backend/src/controllers/studentCatalogController.js (inside backend1.zip)
import Course from "../models/Course.js";
import User from "../models/User.js";
import mongoose from "mongoose";

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
    // Optional debug
    try {
      console.log(
        "[studentCatalog.listCourses]",
        "role:", req.user?.role,
        "roles:", req.user?.roles,
        "orgId(jwt):", req.user?.orgId
      );
    } catch {}

    // Rehydrate orgId from DB if missing on token
    let orgId = req.user?.orgId || null;
    if (!orgId && req.user?.sub) {
      const u = await User.findById(req.user.sub).select("orgId").lean();
      if (u?.orgId) orgId = String(u.orgId);
    }

    // 🔑 Audience rule:
    // - If orgId present  -> ONLY org courses (published), allow any visibility
    // - If no orgId       -> ONLY global public courses (published)
    const query = orgId
      ? { orgId, status: "published" }
      : { orgId: null, visibility: "public", status: "published" };

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
          "ownerId",
          "visibility",
          "status",
          "duration",
          "durationHours",
          "createdAt",
          "updatedAt",
        ].join(" ")
      )
      .sort({ createdAt: -1 })
      .lean();

    // Mirror listCatalogCards field names
    const items = docs.map((c) => ({
      id: String(c._id),
      title: c.title || "",
      slug: c.slug || null,
      description: c.description || "",
      category: c.category || null,
      tags: Array.isArray(c.tags) ? c.tags.filter(Boolean) : [],
      cover: c.bundleCoverUrl || c.coverUrl || null,
      previewUrl: c.demoVideoUrl || null,

      // price is in paise; frontend computes sale/MRP with discountPercent
      price: Number.isFinite(c.price) ? Number(c.price) : null,
      discountPercent: Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0,
      discount: Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0, // legacy alias

      rating: Number.isFinite(c.ratingAvg) ? Number(c.ratingAvg) : 0,
      ratingCount: Number.isFinite(c.ratingCount) ? Number(c.ratingCount) : 0,

      level: c.level || "all",
      visibility: c.visibility || "unlisted",
      status: c.status || "draft",

      orgId: c.orgId ? String(c.orgId) : null,
      ownerId: c.ownerId ? String(c.ownerId) : null,

      duration: c.duration || null,
      durationHours: Number.isFinite(c.durationHours) ? Number(c.durationHours) : undefined,

      createdAt: c.createdAt || null,
      updatedAt: c.updatedAt || null,
    }));

    return res.json(items);
  } catch (e) {
    console.error("[students/courses] error:", e);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

// NEW: minimal “cards” payload for Tracks page
export async function listCatalogCards(req, res) {
  try {
    // infer orgId like listCourses (JWT → DB fallback)
    let orgId = req.user?.orgId || null;
    if (!orgId && req.user?.sub) {
      try {
        const u = await User.findById(req.user.sub).select("orgId").lean();
        if (u?.orgId) orgId = String(u.orgId);
      } catch {}
    }

    // pagination
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 12;
    const cursor = (req.query.cursor || "").toString().trim();

    // public courses + same-org courses
    const $or = [{ orgId: null, visibility: "public", status: "published" }];
    if (orgId) $or.push({ orgId, status: "published" });

    const query = { $or };
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

    const items = docs.slice(0, limit).map((c) => {
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
        discountPercent: Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0,
        // Optional alias, helps if any UI still reads `discount`
        discount: Number.isFinite(c.discountPercent) ? Number(c.discountPercent) : 0,
        rating: Number.isFinite(c.ratingAvg) ? Number(c.ratingAvg) : 0,
        ratingCount: Number.isFinite(c.ratingCount) ? Number(c.ratingCount) : 0,
        orgId: c.orgId ? String(c.orgId) : null,
        visibility: c.visibility || "unlisted",
        status: c.status || "draft",
        level: c.level || "all",

        // ✅ new: numeric hours for card UI; guaranteed number; falls back to 0
        durationHours: Number.isFinite(durationHours) ? durationHours : 0,
        // (optional) also send durationText if you ever want to show it:
        durationText: c.durationText || null,
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

    // allow org courses or global
    const c = await Course.findOne({ _id: id, $or: [{ orgId }, { orgId: null }] }).lean();
    if (!c) return res.status(404).json({ ok: false, message: "Course not found" });

        // 🔹 NEW: resolve instructor/owner names
    const pickName = (u) =>
      u?.name || u?.fullName || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.displayName || null;

    let ownerName = null, teacherName = null;
    const ids = [];
    if (c.ownerId)   ids.push(String(c.ownerId));
    if (c.teacherId) ids.push(String(c.teacherId));
    if (ids.length) {
      const users = await User.find({ _id: { $in: ids } })
        .select("name fullName firstName lastName displayName")
        .lean();
      const byId = new Map(users.map(u => [String(u._id), u]));
      if (c.ownerId && byId.has(String(c.ownerId)))   ownerName   = pickName(byId.get(String(c.ownerId)));
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
        .sort((a,b) => (Number(a.order)||0) - (Number(b.order)||0))
        .map(ch => ({
          id: ch._id ? String(ch._id) : undefined,
          title: ch.title,
          description: ch.description || ch.subtitle || null,
          coverUrl: ch.coverUrl || null,
          videoUrl: ch.videoUrl || null,
          youtubeUrl: ch.youtubeUrl || null,
          durationSeconds: Number(ch.durationSeconds) || 0,
        })),
    });
  } catch (e) {
    console.error("[studentCatalog.getCourseDetail] error:", e);
    return res.status(500).json({ ok:false, message:"Internal error" });
  }
}