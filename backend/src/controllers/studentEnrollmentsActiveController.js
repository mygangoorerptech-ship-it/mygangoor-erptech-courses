//backend/src/controllers/studentEnrollmentsActiveController.js
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const isOid = (v) => mongoose.isValidObjectId(v);

export async function active(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(401).json({ ok: false });

    // Resolve ids (org fallback same as your catalog controller)
    const studentId = actor._id || actor.sub || actor.id;
    if (!isOid(studentId)) return res.status(400).json({ ok: false, message: "bad student id" });

    let orgId = actor.orgId || null;
    if (!orgId && actor.sub) {
      try {
        const u = await User.findById(actor.sub).select("orgId").lean();
        if (u?.orgId) orgId = String(u.orgId);
      } catch {}
    }

    const scope = { studentId };
    if (orgId && isOid(orgId)) scope.orgId = orgId;

    const [enrs, pays] = await Promise.all([
      Enrollment.find(scope).select("courseId status updatedAt").lean(),
      // newest first; we’ll pick last per course
      Payment.find(scope).select("courseId status updatedAt").sort({ updatedAt: -1 }).lean(),
    ]);

    // Build latest payment per course
    const latestPay = new Map();
    for (const p of pays) {
      const cid = String(p.courseId || "");
      if (!cid) continue;
      if (!latestPay.has(cid)) latestPay.set(cid, p); // first seen is newest
    }

    // Compose response items (shape the UI already understands)
    const byCourse = new Map();

    for (const e of enrs) {
      const cid = String(e.courseId || "");
      if (!cid) continue;
      const item = byCourse.get(cid) || { courseId: cid };
      item.status = e.status || item.status;  // e.g. "premium"
      item.access = e.status || item.access;  // mirror for UI checks
      byCourse.set(cid, item);
    }

    for (const [cid, p] of latestPay.entries()) {
      const item = byCourse.get(cid) || { courseId: cid };
      const ps = String(p.status || "").toLowerCase();
      if (ps === "captured" || ps === "verified") {
        item.paymentStatus = "paid";
        item.paidAt = (p.updatedAt || p.createdAt || null)?.toISOString
          ? p.updatedAt.toISOString()
          : (p.updatedAt || null);
      } else {
        item.paymentStatus = ps; // pending/submitted/etc
      }
      byCourse.set(cid, item);
    }

    return res.json({ ok: true, items: Array.from(byCourse.values()) });
  } catch (e) {
    console.error("[studentEnrollments.active] error", e);
    return res.status(500).json({ ok: false, message: "active enrollments failed" });
  }
}
