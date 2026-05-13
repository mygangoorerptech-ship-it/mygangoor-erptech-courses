//backend/src/controllers/studentsController.js
import User from "../models/User.js";
import { safeRegex } from "../utils/safeRegex.js";
import StudentFormProfile from "../models/StudentFormProfile.js";

export async function list(req, res) {
  const actor = req.user;
  if (!actor?.orgId && actor?.role !== "superadmin") {
    return res.status(403).json({ ok: false, message: "forbidden" });
  }

  const { q, limit = 200, lite = 1 } = req.query || {};
  const and = [{
    role: { $in: ["student", "orguser"] }
  }];

  // scope: SA can query any org with ?orgId; admin/teacher are scoped to their own org
  if (actor.role !== "superadmin") and.push({ orgId: actor.orgId });
  if (actor.role === "superadmin" && req.query?.orgId) and.push({ orgId: req.query.orgId });

  if (q) {
    // H-4 fix: escape metacharacters to prevent ReDoS
    const rx = { $regex: safeRegex(q), $options: "i" };
    and.push({ $or: [{ email: rx }, { name: rx }] });
  }

  const docs = await User.find({ $and: and })
    .select(
      lite
        ? "_id email name orgId"
        : "_id email name orgId createdAt"
    )
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 200, 1000))
    .lean();

  const rows = docs.map(d => ({
    id: String(d._id),
    email: d.email,
    name: d.name,
    orgId: d.orgId ? String(d.orgId) : null,
  }));
  return res.json(rows);
}

export async function getUserDetails(req, res) {
  try {
    const actor = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: "User id required",
      });
    }

    const user = await User.findById(id)
      .select("-password -refreshToken")
      .lean();

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User not found",
      });
    }

    // SECURITY:
    // non-superadmin can only access same org
    if (
      actor.role !== "superadmin" &&
      String(user.orgId || "") !== String(actor.orgId || "")
    ) {
      return res.status(403).json({
        ok: false,
        message: "forbidden",
      });
    }

    let formProfile = null;

    if (
      user.role === "student" ||
      user.role === "orguser"
    ) {
      formProfile = await StudentFormProfile.findOne({
        studentId: user._id,
      }).lean();
    }

    return res.json({
      ok: true,
      user: {
        id: String(user._id),
        name: user.name || "",
        email: user.email || "",
        role: user.role || "",
        status: user.status || "",
        orgId: user.orgId || null,
        isVerified: !!user.isVerified,
        createdAt: user.createdAt || null,
      },
      formProfile,
    });
  } catch (e) {
    console.error("[students.getUserDetails]", e);

    return res.status(500).json({
      ok: false,
      message: "Failed to fetch user details",
    });
  }
}