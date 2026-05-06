// backend/src/services/paymentReconciliationService.js

import Payment from "../models/Payment.js";
import { ensureEnrollment } from "./enrollmentService.js";

function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

export async function reconcileOfflinePayment(paymentDoc) {

  try {

    if (!paymentDoc) return false;

    // Only offline pending_verification payments participate
    if (
      paymentDoc.type !== "offline" ||
      paymentDoc.status !== "pending_verification"
    ) {
      return false;
    }

    // Already reconciled
    if (
      paymentDoc.reconciliationStatus === "matched" ||
      paymentDoc.matchedPaymentId
    ) {
      return false;
    }

    const paymentId = paymentDoc._id;

    const receiptNo = normalize(paymentDoc.receiptNo);
    const referenceId = normalize(paymentDoc.referenceId);

    const baseQuery = {
      _id: { $ne: paymentId },
      type: "offline",
      status: "pending_verification",
      reconciliationStatus: "none",
      studentId: paymentDoc.studentId,
      courseId: paymentDoc.courseId,
    };

    let match = null;

    // ---------------------------------------------------
    // LEVEL-1 MATCH
    // referenceId exact
    // ---------------------------------------------------

    if (referenceId) {

      const matches = await Payment.find({
        ...baseQuery,
        referenceId: {
          $regex: new RegExp(`^${referenceId}$`, "i"),
        },
      })
        .sort({ createdAt: 1 })
        .limit(2)
        .lean();

      if (matches.length === 1) {
        match = matches[0];
      }
    }

    // ---------------------------------------------------
    // LEVEL-2 MATCH
    // receiptNo exact
    // ---------------------------------------------------

    if (!match && receiptNo) {

      const matches = await Payment.find({
        ...baseQuery,
        receiptNo: {
          $regex: new RegExp(`^${receiptNo}$`, "i"),
        },
      })
        .sort({ createdAt: 1 })
        .limit(2)
        .lean();

      if (matches.length === 1) {
        match = matches[0];
      }
    }

    // ---------------------------------------------------
    // LEVEL-3 MATCH
    // amount + course + student
    // ---------------------------------------------------

    if (!match) {

      const matches = await Payment.find({
        ...baseQuery,
        amount: paymentDoc.amount,
      })
        .sort({ createdAt: 1 })
        .limit(2)
        .lean();

      if (matches.length === 1) {
        match = matches[0];
      }
    }

    // No safe match found
    if (!match) {
      return false;
    }

    const now = new Date();

    // ---------------------------------------------------
    // Mark BOTH payments reconciled
    // ---------------------------------------------------

    await Payment.updateMany(
      {
        _id: {
          $in: [paymentDoc._id, match._id],
        },
      },
      {
        $set: {
          status: "captured",
          reconciliationStatus: "matched",
          matchedAt: now,
        },
      }
    );

    // Link payment A -> B
    await Payment.updateOne(
      { _id: paymentDoc._id },
      {
        $set: {
          matchedPaymentId: match._id,
        },
      }
    );

    // Link payment B -> A
    await Payment.updateOne(
      { _id: match._id },
      {
        $set: {
          matchedPaymentId: paymentDoc._id,
        },
      }
    );

    // ---------------------------------------------------
    // Enrollment
    // ---------------------------------------------------

    const enrollOk = await ensureEnrollment({
      studentId: paymentDoc.studentId,
      courseId: paymentDoc.courseId,
      orgId: paymentDoc.orgId || null,
      paymentId: paymentDoc._id,
      source: "offline",
      managerId: paymentDoc.managerId || null,
    });

    // Recovery fallback
    if (enrollOk === false) {

      await Payment.updateMany(
        {
          _id: {
            $in: [paymentDoc._id, match._id],
          },
        },
        {
          $set: {
            needsEnrollment: true,
          },
          $inc: {
            enrollmentRetryCount: 1,
          },
        }
      );
    }

    console.log("[RECONCILED]", {
      paymentA: String(paymentDoc._id),
      paymentB: String(match._id),
    });

    return true;

  } catch (e) {

    console.error(
      "[paymentReconciliationService]",
      e?.message
    );

    return false;
  }
}