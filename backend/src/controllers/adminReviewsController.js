// backend/src/controllers/adminReviewsController.js
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Course from "../models/Course.js";

const { ObjectId } = mongoose.Types;
const toId = (v) => {
  try { return v ? new ObjectId(v) : null; } catch { return null; }
};

function roleScopeMatch(req) {
  const role = String(req.user?.role || "").toLowerCase();
  const m = {};
  if (role === "superadmin") {
    const orgId = toId(req.query.orgId);
    const ownerId = toId(req.query.ownerId);
    if (orgId) m["course.orgId"] = orgId;
    if (ownerId) m["course.ownerId"] = ownerId;
    return m;
  }
  if (role === "admin" || role === "teacher" || role === "orgadmin") {
    if (req.user?.orgId) m["course.orgId"] = toId(req.user.orgId);
    if (role === "teacher" && req.user?._id) m["course.ownerId"] = toId(req.user._id);
    return m;
  }
  // deny others
  m["course._id"] = null;
  return m;
}

function sortFromKey(key = "new") {
  switch (key) {
    case "old":  return { createdAt: 1, _id: -1 };
    case "high": return { rating: -1, createdAt: -1, _id: -1 };
    case "low":  return { rating: 1, createdAt: -1, _id: -1 };
    default:     return { createdAt: -1, _id: -1 }; // "new"
  }
}

// GET /api/admin/reviews
export async function list(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize) || 10));
    const sort = sortFromKey(String(req.query.sort || "new"));

    const courseId = toId(req.query.courseId);
    const minStars = req.query.minStars ? Number(req.query.minStars) : null;
    const statusKey = ["visible", "hidden", "pending"].includes(String(req.query.status))
      ? String(req.query.status)
      : null;
    const q = String(req.query.q || "").trim();

    const matchReview = {};
    if (minStars != null && !Number.isNaN(minStars)) matchReview.rating = { $gte: minStars };

    const matchScope = roleScopeMatch(req);
    if (courseId) matchScope["course._id"] = courseId;

    const searchMatch = q
      ? {
          $or: [
            { comment: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },               // review's own name field
            { "course.title": { $regex: q, $options: "i" } },
            { "user.name": { $regex: q, $options: "i" } },
            { "user.email": { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      { $addFields: {
          // unify author id (supports either field)
          authorId: { $ifNull: ["$userId", "$studentId"] },
          // normalize status if missing
          modStatus: { $ifNull: ["$status", "visible"] },
        }
      },

      // Join course
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },

      // Join user for name/email display
      {
        $lookup: {
          from: "users",
          localField: "authorId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // Optional org info
      {
        $lookup: {
          from: "organizations",
          localField: "course.orgId",
          foreignField: "_id",
          as: "org",
        },
      },
      { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },

      // role/org scoping
      { $match: { ...matchScope } },

      // rating filter
      { $match: { ...matchReview } },

      // status filter (applied on normalized field)
      ...(statusKey ? [{ $match: { modStatus: statusKey } }] : []),

      // free text search
      { $match: { ...searchMatch } },

      { $sort: sort },

      {
        $facet: {
          rows: [
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
              $project: {
                id: "$_id",
                rating: 1,
                comment: { $ifNull: ["$comment", ""] },
                status: "$modStatus",
                courseId: "$course._id",
                courseTitle: "$course.title",
                courseSlug: "$course.slug",
                orgId: "$course.orgId",
                orgName: "$org.name",
                userId: "$authorId",
                // prefer the joined user's name/email; fall back to review.name
                userName: { $ifNull: ["$user.name", "$name"] },
                userEmail: "$user.email",
                createdAt: 1,
                _id: 0,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const out = await Review.aggregate(pipeline);
    const rows = out?.[0]?.rows || [];
    const total = out?.[0]?.total?.[0]?.count || 0;

    const mapped = rows.map((r) => ({
      ...r,
      id: String(r.id),
      courseId: String(r.courseId),
      orgId: r.orgId ? String(r.orgId) : null,
      userId: r.userId ? String(r.userId) : null,
    }));

    return res.json({ rows: mapped, total, page, pageSize });
  } catch (err) {
    console.error("[admin reviews.list] error:", err);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

// GET /api/admin/reviews/summary
export async function summary(req, res) {
  try {
    const courseId = toId(req.query.courseId);
    const matchScope = roleScopeMatch(req);
    if (courseId) matchScope["course._id"] = courseId;

    const base = [
      { $addFields: { authorId: { $ifNull: ["$userId", "$studentId"] } } },
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $lookup: {
          from: "organizations",
          localField: "course.orgId",
          foreignField: "_id",
          as: "org",
        },
      },
      { $unwind: { path: "$org", preserveNullAndEmptyArrays: true } },
      { $match: { ...matchScope } },
    ];

    const overallAgg = await Review.aggregate([
      ...base,
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
        },
      },
    ]);
    const overall = overallAgg[0] || { count: 0, avgRating: 0 };

    const coursesAgg = await Review.aggregate([
      ...base,
      {
        $group: {
          _id: "$course._id",
          courseTitle: { $first: "$course.title" },
          orgId: { $first: "$course.orgId" },
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
        },
      },
      { $sort: { count: -1, _id: -1 } },
      { $limit: 200 },
    ]);

    let orgs = null;
    if (String(req.user?.role || "").toLowerCase() === "superadmin") {
      const orgAgg = await Review.aggregate([
        ...base,
        {
          $group: {
            _id: "$course.orgId",
            orgName: { $first: "$org.name" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1, _id: -1 } },
        { $limit: 200 },
      ]);
      orgs = orgAgg.map((o) => ({ orgId: String(o._id), orgName: o.orgName || "Organization", count: o.count }));
    }

    return res.json({
      overall: {
        count: overall.count || 0,
        avgRating: overall.avgRating || 0,
      },
      courses: coursesAgg.map((c) => ({
        courseId: String(c._id),
        courseTitle: c.courseTitle,
        orgId: c.orgId ? String(c.orgId) : null,
        orgName: null,
        count: c.count,
        avgRating: c.avgRating || 0,
      })),
      orgs,
    });
  } catch (err) {
    console.error("[admin reviews.summary] error:", err);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

// PATCH /api/admin/reviews/:id  (superadmin only)
export async function updateOne(req, res) {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "superadmin") {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "Bad id" });

    const { status } = req.body || {};
    if (!["visible", "hidden", "pending"].includes(status)) {
      return res.status(400).json({ ok: false, message: "Invalid status" });
    }

    const out = await Review.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean();
    if (!out) return res.status(404).json({ ok: false, message: "Not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin reviews.updateOne] error:", err);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}

// DELETE /api/admin/reviews/:id  (superadmin only)
export async function removeOne(req, res) {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "superadmin") {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "Bad id" });

    const out = await Review.findByIdAndDelete(id).lean();
    if (!out) return res.status(404).json({ ok: false, message: "Not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin reviews.removeOne] error:", err);
    return res.status(500).json({ ok: false, message: "Internal error" });
  }
}
