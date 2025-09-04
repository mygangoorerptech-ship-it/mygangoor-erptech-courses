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

// Admin/vendor list (org-scoped)
export async function list(req, res) {
  const actor = req.user;
  if (!actor?.orgId) return res.status(403).json({ ok:false });

  const { studentId, courseId, status } = req.query || {};
  const and = [{ orgId: actor.orgId }];
  if (studentId) and.push({ studentId });
  if (courseId) and.push({ courseId });
  if (status) and.push({ status });

  const rows = await Enrollment.find({ $and: and }).sort({ createdAt: -1 }).lean();
  return res.json(rows.map(sanitize));
}

// Student: my enrollments
export async function my(req, res) {
  const actor = req.user;
  if (!actor) return res.status(403).json({ ok:false });

  const rows = await Enrollment.find({ studentId: actor._id }).sort({ createdAt: -1 }).lean();
  return res.json(rows.map(sanitize));
}
