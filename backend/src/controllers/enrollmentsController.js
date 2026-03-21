//backend/src/controllers/enrollmentsController.js
import Enrollment from "../models/Enrollment.js";

function sanitize(e) {
  if (!e) return e;
  const o = e.toObject ? e.toObject() : e;
  return {
    id: String(o._id),
    studentId: String(o.studentId),
    courseId: String(o.courseId),
    orgId: String(o.orgId),
    status: o.status,
    source: o.source,
    paymentId: o.paymentId ? String(o.paymentId) : null,
    managerId: o.managerId ? String(o.managerId) : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// Admin/teacher list (org-scoped)
// M-3 fix: paginated to prevent full collection scans on large orgs.
export async function list(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok:false });

  const { studentId, courseId, status } = req.query || {};

  // Pagination params — default page=1, limit=100, hard cap at 500
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const skip  = (page - 1) * limit;

  const and = [{ orgId: actor.orgId }];
  if (studentId) and.push({ studentId });
  if (courseId)  and.push({ courseId });
  if (status)    and.push({ status });

  const [rows, total] = await Promise.all([
    Enrollment.find({ $and: and })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Enrollment.countDocuments({ $and: and }),
  ]);

  return res.json({ items: rows.map(sanitize), total, page, pageSize: limit });
}

// Student: my enrollments
export async function my(req, res) {
  const actor = req.user;
  if (!actor) return res.status(403).json({ ok:false });

  const rows = await Enrollment.find({ studentId: actor._id }).sort({ createdAt: -1 }).lean();
  return res.json(rows.map(sanitize));
}
