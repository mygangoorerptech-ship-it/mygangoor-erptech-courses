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

      amount: paymentDoc.amount,
    };

    // ---------------------------------------------------
    // ORG SAFETY
    // ---------------------------------------------------

    if (paymentDoc.orgId) {

      baseQuery.orgId = paymentDoc.orgId;

    } else {

      // superadmin/global payment
      baseQuery.orgId = null;
    }

    // ---------------------------------------------------
    // VALID SOURCE PAIRS ONLY
    // ---------------------------------------------------

    if (paymentDoc.createdSource === "student_claim") {

      baseQuery.createdSource = {
        $in: [
          "admin_manual",
          "teacher_manual",
          "superadmin_manual",
        ],
      };

    } else {

      baseQuery.createdSource = "student_claim";
    }

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

    // No safe match found
    if (!match) {
      return false;
    }

    const now = new Date();

    // ---------------------------------------------------
    // Select PRIMARY payment
    // oldest payment survives as authoritative
    // ---------------------------------------------------

    const priorityMap = {
      admin_manual: 1,
      teacher_manual: 2,
      superadmin_manual: 3,
      student_claim: 4,
    };

    const paymentPriority =
      priorityMap[paymentDoc.createdSource] || 999;

    const matchPriority =
      priorityMap[match.createdSource] || 999;

    const primaryPayment =
      paymentPriority <= matchPriority
        ? paymentDoc
        : match;

    const secondaryPayment =
      String(primaryPayment._id) === String(paymentDoc._id)
        ? match
        : paymentDoc;

    // ---------------------------------------------------
    // Capture ONLY primary payment
    // ---------------------------------------------------

    // ---------------------------------------------------
    // Preserve structured joinForm notes
    // ---------------------------------------------------

    let mergedNotes = primaryPayment.notes || null;

    // helper
    const extractJoinForm = (raw) => {

      if (!raw) return null;

      try {

        const parsed =
          typeof raw === "string"
            ? JSON.parse(raw)
            : raw;

        if (
          parsed &&
          typeof parsed === "object"
        ) {

          // already wrapped
          if (
            parsed.joinForm &&
            typeof parsed.joinForm === "object"
          ) {
            return parsed;
          }

          // raw form object
          return {
            joinForm: parsed,
          };
        }

      } catch { }

      return null;
    };

    // Prefer existing primary structured notes
    const primaryForm =
      extractJoinForm(primaryPayment.notes);

    if (primaryForm) {

      mergedNotes =
        JSON.stringify(primaryForm);

    } else {

      // fallback from secondary payment
      const secondaryForm =
        extractJoinForm(secondaryPayment.notes);

      if (secondaryForm) {

        mergedNotes =
          JSON.stringify(secondaryForm);
      }
    }

    await Payment.updateOne(
      {
        _id: primaryPayment._id,
        status: "pending_verification",
      },
      {
        $set: {
          status: "captured",

          reconciliationStatus: "none",

          matchedPaymentId: secondaryPayment._id,

          matchedAt: now,

          verifiedAt: now,

          notes: mergedNotes,
        },
      }
    );

    // ---------------------------------------------------
    // Mark secondary payment as matched only
    // DO NOT capture duplicate
    // ---------------------------------------------------

    await Payment.updateOne(
      {
        _id: secondaryPayment._id,
      },
      {
        $set: {
          status: "reconciled",
          reconciliationStatus: "matched",
          matchedPaymentId: primaryPayment._id,
          matchedAt: now,
        },
      }
    );

    // ---------------------------------------------------
    // Enrollment
    // ---------------------------------------------------

    const enrollOk = await ensureEnrollment({
      studentId: primaryPayment.studentId,
      courseId: primaryPayment.courseId,
      orgId: primaryPayment.orgId || null,
      paymentId: primaryPayment._id,
      source: "offline",
      managerId: primaryPayment.managerId || null,
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