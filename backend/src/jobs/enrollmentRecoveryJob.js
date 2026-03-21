// backend/src/jobs/enrollmentRecoveryJob.js
// C-2 fix: recover payments whose enrollment creation failed.
//
// Design:
//   - Runs every 5 minutes via scheduler.
//   - Finds Payment documents where needsEnrollment === true.
//   - Retries ensureEnrollment() for each.
//   - On success: clears needsEnrollment flag.
//   - On failure: increments enrollmentRetryCount (for alerting / manual review).
//   - Capped at MAX_RETRIES to prevent infinite retry loops on permanently bad data.
//   - Fully idempotent: the Enrollment upsert unique index (studentId+courseId+orgId)
//     ensures no duplicate enrollments even if the job runs concurrently.

import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";

const isOid = (v) => mongoose.isValidObjectId(v);
const { ObjectId } = mongoose.Types;
const toId = (v) => (v && isOid(v) ? new ObjectId(String(v)) : null);

const MAX_RETRIES = 10;

// Standalone ensureEnrollment — mirrors logic in paymentsController + razorpayController
// without importing from those modules (avoids circular deps).
async function ensureEnrollment({ studentId, courseId, orgId, paymentId, source, managerId }) {
  const sid = toId(studentId);
  const cid = toId(courseId);
  const oid = toId(orgId);

  if (!sid || !cid || !oid) {
    console.warn("[enrollmentRecoveryJob] skipped: invalid ids", {
      studentId: !!sid, courseId: !!cid, orgId: !!oid,
    });
    return false;
  }

  const filter = { studentId: sid, courseId: cid, orgId: oid };
  const update = {
    $setOnInsert: {
      studentId: sid,
      courseId: cid,
      orgId: oid,
      status: "premium",
      source: source || "offline",
      ...(managerId ? { managerId: toId(managerId) } : {}),
    },
  };
  const pid = toId(paymentId);
  if (pid) update.$set = { paymentId: pid };

  try {
    await Enrollment.updateOne(filter, update, { upsert: true, setDefaultsOnInsert: true });
    return true;
  } catch (e) {
    if (e?.code === 11000) return true; // duplicate key = already enrolled (idempotent)
    console.error("[enrollmentRecoveryJob] ensureEnrollment failed:", e?.message, {
      studentId: String(sid), courseId: String(cid), orgId: String(oid),
    });
    return false;
  }
}

// Main job function — called by scheduler every 5 minutes.
export async function runEnrollmentRecovery() {
  let processed = 0;
  let recovered = 0;
  let failed    = 0;

  try {
    const pending = await Payment.find({ needsEnrollment: true })
      .select("_id studentId courseId orgId paymentId managerId source enrollmentRetryCount type")
      .limit(200) // process at most 200 per tick
      .lean();

    if (!pending.length) return;

    console.log(`[enrollmentRecoveryJob] found ${pending.length} payment(s) needing enrollment`);

    for (const pay of pending) {
      processed++;

      // Stop retrying after MAX_RETRIES — likely a data problem; alert manually.
      if ((pay.enrollmentRetryCount || 0) >= MAX_RETRIES) {
        console.error("[enrollmentRecoveryJob] max retries reached — manual review required", {
          paymentId: String(pay._id),
          studentId: String(pay.studentId),
          courseId: String(pay.courseId),
          retryCount: pay.enrollmentRetryCount,
        });
        // Clear the flag so we stop retrying but record a final high count
        await Payment.updateOne(
          { _id: pay._id },
          { $set: { needsEnrollment: false } }
        ).catch(() => {});
        failed++;
        continue;
      }

      const ok = await ensureEnrollment({
        studentId: pay.studentId,
        courseId:  pay.courseId,
        orgId:     pay.orgId,
        paymentId: pay._id,
        source:    pay.source || (pay.type === "online" ? "online" : "offline"),
        managerId: pay.managerId || null,
      });

      if (ok) {
        await Payment.updateOne(
          { _id: pay._id },
          { $set: { needsEnrollment: false } }
        );
        recovered++;
        console.log("[enrollmentRecoveryJob] enrollment recovered", { paymentId: String(pay._id) });
      } else {
        await Payment.updateOne(
          { _id: pay._id },
          { $inc: { enrollmentRetryCount: 1 } }
        ).catch(() => {});
        failed++;
      }
    }

    if (processed > 0) {
      console.log("[enrollmentRecoveryJob] done", { processed, recovered, failed });
    }
  } catch (e) {
    console.error("[enrollmentRecoveryJob] unexpected error:", e?.message);
  }
}
