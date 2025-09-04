//backend/src/controllers/joinStateController.js
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const isOid = (v) => mongoose.isValidObjectId(v);

export async function state(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(401).json({ ok: false });

    // Resolve studentId and orgId (fallback via DB like your catalog controller)
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

    const [enrollments, payments] = await Promise.all([
      Enrollment.find(scope).select("courseId status orgId updatedAt").lean(),
      Payment.find(scope).select("courseId status amount orgId updatedAt").sort({ updatedAt: -1 }).lean(),
    ]);

    // Build latest-per-course payment + enrollment status
    const states = {};

    for (const e of enrollments) {
      const cid = String(e.courseId);
      if (!cid) continue;
      states[cid] ||= {};
      states[cid].enrollment = e.status || null; // e.g. "premium"
    }

    // pick newest payment per course
    const seenTs = {};
    for (const p of payments) {
      const cid = String(p.courseId);
      if (!cid) continue;
      const ts = new Date(p.updatedAt || p.createdAt || 0).valueOf();
      if (!seenTs[cid] || ts > seenTs[cid]) {
        seenTs[cid] = ts;
        states[cid] ||= {};
        states[cid].payment = {
          status: (p.status || "").toLowerCase(),  // "captured", "pending", "verified", ...
          amount: Number.isFinite(Number(p.amount)) ? Number(p.amount) : null, // paise
        };
      }
    }

    return res.json({ ok: true, states });
  } catch (e) {
    console.error("[joinState.state] error", e);
    return res.status(500).json({ ok: false, message: "join state failed" });
  }
}
