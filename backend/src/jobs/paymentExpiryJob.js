// backend/src/jobs/paymentExpiryJob.js
//
// Payment Expiry Engine
//
// Purpose:
//   Mark stale online "pending" payments as "failed" after verifying with
//   Razorpay that the order was NOT paid. Prevents abandoned orders from
//   permanently blocking a student's ability to re-enroll.
//
// Safety rules (order-sensitive):
//   1. ALWAYS verify with Razorpay before expiring — never expire blindly.
//   2. If Razorpay API is unreachable → SKIP (do not expire).
//   3. If Razorpay says order is "paid" → recover enrollment instead.
//   4. If no providerOrderId → expired before reaching Razorpay → safe to fail.
//   5. Unknown Razorpay order status → SKIP.
//
// Webhook safety:
//   The webhook uses findOneAndUpdate({status:{$ne:"captured"}}), so a
//   late-arriving webhook for a Razorpay-confirmed capture will correctly
//   resurrect a locally-expired payment. This is intentional and correct.

import Payment from "../models/Payment.js";
import { ensureEnrollment } from "../services/enrollmentService.js";

const STALE_AGE_MS = 45 * 60 * 1000; // 45 minutes
const BATCH_SIZE = 100;

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

async function rzpGetOrderStatus(orderId) {
  try {
    const auth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
    const r = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!r.ok) return null;
    const body = await r.json();
    return body?.status ?? null; // "created" | "attempted" | "paid"
  } catch {
    return null;
  }
}

export async function runPaymentExpiry() {
  let processed = 0;
  let expired = 0;
  let recovered = 0;
  let skipped = 0;

  try {
    const cutoff = new Date(Date.now() - STALE_AGE_MS);

    const stale = await Payment.find({
      type: "online",
      status: "pending",
      createdAt: { $lt: cutoff },
    })
      .select("_id providerOrderId studentId courseId orgId managerId")
      .limit(BATCH_SIZE)
      .lean();

    if (!stale.length) return;

    console.log(`[paymentExpiryJob] found ${stale.length} stale pending payment(s)`);

    for (const pay of stale) {
      processed++;

      // No order ID — payment was created locally but never reached Razorpay.
      // Safe to expire immediately without an API call.
      if (!pay.providerOrderId) {
        await Payment.updateOne(
          { _id: pay._id },
          {
            $set: {
              status: "failed",
              lastEnrollmentError: "auto-expired: no providerOrderId (never reached Razorpay)",
            },
          }
        ).catch((e) => console.error("[paymentExpiryJob] fail update error:", e?.message));
        expired++;
        console.log("[EXPIRY] no-orderId payment expired:", String(pay._id));
        continue;
      }

      // Always verify with Razorpay before expiring.
      const orderStatus = await rzpGetOrderStatus(pay.providerOrderId);

      if (orderStatus === null) {
        // Razorpay unreachable — skip, do not expire.
        skipped++;
        console.warn("[paymentExpiryJob] Razorpay unreachable for order:", pay.providerOrderId, "— skipping");
        continue;
      }

      if (orderStatus === "paid") {
        // Razorpay confirms this order was paid — our local record is stale.
        // Capture the payment and recover enrollment.
        const captureRes = await Payment.updateOne(
          { _id: pay._id, status: { $ne: "captured" } },
          { $set: { status: "captured", providerVerified: true } }
        ).catch((e) => {
          console.error("[paymentExpiryJob] capture update error:", e?.message);
          return null;
        });

        // Another worker already captured/recovered this payment.
        if (!captureRes?.matchedCount) {
          skipped++;
          continue;
        }

        const enrollOk = await ensureEnrollment({
          studentId: pay.studentId,
          courseId: pay.courseId,
          orgId: pay.orgId || null,
          paymentId: pay._id,
          source: "online",
          managerId: pay.managerId || null,
        });

        if (!enrollOk) {
          await Payment.updateOne(
            { _id: pay._id },
            {
              $set: { needsEnrollment: true },
              $inc: { enrollmentRetryCount: 1 },
            }
          ).catch((e) => console.error("[paymentExpiryJob] needsEnrollment flag error:", e?.message));
        }

        recovered++;
        console.log("[EXPIRY RECOVERY] Razorpay-paid order captured:", pay.providerOrderId, "enrollOk:", enrollOk);
        continue;
      }

      if (orderStatus === "created" || orderStatus === "attempted") {
        // Razorpay confirms order is NOT paid — safe to expire.
        await Payment.updateOne(
          { _id: pay._id },
          {
            $set: {
              status: "failed",
              lastEnrollmentError: `auto-expired: Razorpay order status was "${orderStatus}"`,
            },
          }
        ).catch((e) => console.error("[paymentExpiryJob] expiry update error:", e?.message));
        expired++;
        console.log("[EXPIRY] payment expired:", String(pay._id), "razorpay status:", orderStatus);
        continue;
      }

      // Unknown Razorpay order status (e.g. "invoice") — skip conservatively.
      skipped++;
      console.warn("[paymentExpiryJob] unknown Razorpay order status:", orderStatus, "for order:", pay.providerOrderId, "— skipping");
    }

    console.log("[paymentExpiryJob] completed", { processed, expired, recovered, skipped });
  } catch (e) {
    console.error("[paymentExpiryJob] fatal error:", e?.message);
  }
}
