//backend/src/controllers/studentsController.js
import User from "../models/User.js";
import { safeRegex } from "../utils/safeRegex.js";

export async function list(req, res) {
  const actor = req.user;
  if (!actor?.orgId && actor?.role !== "superadmin") {
    return res.status(403).json({ ok: false, message: "forbidden" });
  }

  const { q, limit = 200, lite = 1 } = req.query || {};
  const and = [{ role: "student" }];

  // scope: SA can query any org with ?orgId; admin/teacher are scoped to their own org
  if (actor.role !== "superadmin") and.push({ orgId: actor.orgId });
  if (actor.role === "superadmin" && req.query?.orgId) and.push({ orgId: req.query.orgId });

  if (q) {
    // H-4 fix: escape metacharacters to prevent ReDoS
    const rx = { $regex: safeRegex(q), $options: "i" };
    and.push({ $or: [{ email: rx }, { name: rx }] });
  }

  const docs = await User.find({ $and: and })
    .select(lite ? "_id email name" : "_id email name orgId createdAt")
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 200, 1000))
    .lean();

  const rows = docs.map(d => ({ id: String(d._id), email: d.email, name: d.name }));
  return res.json(rows);
}
