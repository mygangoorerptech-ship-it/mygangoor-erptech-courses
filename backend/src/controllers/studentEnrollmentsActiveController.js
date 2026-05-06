//backend/src/controllers/studentEnrollmentsActiveController.js

import mongoose from "mongoose";

import Enrollment from "../models/Enrollment.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import CourseAssignment from "../models/CourseAssignment.js";

const isOid = (v) =>
  mongoose.isValidObjectId(v);

export async function active(req, res) {
  try {
    const actor = req.user;

    if (!actor) {
      return res
        .status(401)
        .json({ ok: false });
    }

    /**
     * Resolve authenticated student id
     */
    const studentId =
      actor._id ||
      actor.sub ||
      actor.id;

    if (!isOid(studentId)) {
      return res.status(400).json({
        ok: false,
        message: "bad student id",
      });
    }

    /**
     * Resolve orgId safely
     */
    let orgId =
      actor.orgId || null;

    if (!orgId && actor.sub) {
      try {
        const u = await User.findById(
          actor.sub
        )
          .select("orgId")
          .lean();

        if (u?.orgId) {
          orgId = String(u.orgId);
        }
      } catch {
        // silent fallback
      }
    }

    /**
     * IMPORTANT:
     * Scope ONLY by studentId.
     *
     * Cross-org enrollments
     * may belong to different
     * org/course ownership.
     */
    const scope = {
      studentId,
    };

    /**
     * Fetch:
     * - enrollments
     * - payments
     * - center assigned courses
     */
    const [
      enrs,
      pays,
      assignments,
    ] = await Promise.all([
      Enrollment.find(scope)
        .select(
          "courseId status updatedAt"
        )
        .lean(),

      Payment.find(scope)
        .select(
          "courseId status updatedAt createdAt"
        )
        .sort({
          updatedAt: -1,
        })
        .lean(),

      orgId
        ? CourseAssignment.find({
            centerId: orgId,
            isActive: true,
          })
            .select("courseId")
            .lean()
        : [],
    ]);

    /**
     * Latest payment per course
     */
    const latestPay = new Map();

    for (const p of pays) {
      const cid = String(
        p.courseId || ""
      );

      if (!cid) continue;

      /**
       * first seen = newest
       */
      if (!latestPay.has(cid)) {
        latestPay.set(cid, p);
      }
    }

    /**
     * Final composed map
     */
    const byCourse = new Map();

    /**
     * Enrollment access
     */
    for (const e of enrs) {
      const cid = String(
        e.courseId || ""
      );

      if (!cid) continue;

      const item =
        byCourse.get(cid) || {
          courseId: cid,
        };

      /**
       * Example:
       * premium/free/trial
       */
      item.status =
        e.status || item.status;

      item.access =
        e.status || item.access;

      item.enrollmentAccess = true;

      byCourse.set(cid, item);
    }

    /**
     * Center assignment access
     */
    for (const a of assignments) {
      const cid = String(
        a.courseId || ""
      );

      if (!cid) continue;

      const item =
        byCourse.get(cid) || {
          courseId: cid,
        };

      /**
       * Mark accessible
       * through center assignment
       */
      item.status =
        item.status || "premium";

      item.access =
        item.access || "premium";

      item.assignmentAccess = true;

      byCourse.set(cid, item);
    }

    /**
     * Payment state
     */
    for (const [
      cid,
      p,
    ] of latestPay.entries()) {
      const item =
        byCourse.get(cid) || {
          courseId: cid,
        };

      const ps = String(
        p.status || ""
      ).toLowerCase();

      if (
        ps === "captured" ||
        ps === "verified"
      ) {
        item.paymentStatus = "paid";

        const d =
          p.updatedAt ||
          p.createdAt ||
          null;

        item.paidAt =
          d instanceof Date
            ? d.toISOString()
            : d;
      } else {
        item.paymentStatus = ps;
      }

      byCourse.set(cid, item);
    }

    /**
     * Final response
     */
    return res.json({
      ok: true,
      items: Array.from(
        byCourse.values()
      ),
    });
  } catch (e) {
    console.error(
      "[studentEnrollments.active] error",
      e
    );

    return res.status(500).json({
      ok: false,
      message:
        "active enrollments failed",
    });
  }
}