// backend/src/jobs/enrollmentRecoveryJob.js
//
// Enrollment Recovery Engine
//
// Purpose:
//   Recover captured payments where enrollment creation failed.
//
// Flow:
//   1. Find payments where needsEnrollment=true
//   2. Retry ensureEnrollment()
//   3. On success:
//        - clear recovery flag
//        - clear error metadata
//   4. On failure:
//        - increment retry counter
//        - store retry metadata
//   5. After MAX_RETRIES:
//        - keep payment visible for admin review
//        - DO NOT clear needsEnrollment
//
// Safety:
//   - Fully idempotent
//   - Enrollment unique index prevents duplicates
//   - Shared enrollment service is single source of truth
//   - Global courses supported (orgId may be null)

import Payment from "../models/Payment.js";
import { ensureEnrollment } from "../services/enrollmentService.js";

const MAX_RETRIES = 10;
const BATCH_SIZE = 200;

// Main recovery worker
export async function runEnrollmentRecovery() {
  let processed = 0;
  let recovered = 0;
  let failed = 0;

  try {

    const pending = await Payment.find({
      needsEnrollment: true,
      status: "captured",
    })
      .select(
        "_id studentId courseId orgId managerId type enrollmentRetryCount"
      )
      .sort({ updatedAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (!pending.length) {
      return;
    }

    console.log(
      `[enrollmentRecoveryJob] found ${pending.length} payment(s)`
    );

    for (const pay of pending) {

      processed++;

      // Max retry protection
      if ((pay.enrollmentRetryCount || 0) >= MAX_RETRIES) {

        console.error(
          "[enrollmentRecoveryJob] max retries exceeded",
          {
            paymentId: String(pay._id),
            studentId: String(pay.studentId),
            courseId: String(pay.courseId),
            retryCount: pay.enrollmentRetryCount,
          }
        );

        // IMPORTANT:
        // Keep needsEnrollment=true
        // so admin dashboard can still detect broken payments.
        await Payment.updateOne(
          { _id: pay._id },
          {
            $set: {
              lastEnrollmentError:
                "Max enrollment retries exceeded",
              lastEnrollmentRetryAt: new Date(),
            },
          }
        ).catch(() => {});

        failed++;
        continue;
      }

      try {

        const ok = await ensureEnrollment({
          studentId: pay.studentId,
          courseId: pay.courseId,
          orgId: pay.orgId || null,
          paymentId: pay._id,
          source:
            pay.type === "online"
              ? "online"
              : "offline",
          managerId: pay.managerId || null,
        });

        if (ok) {

          await Payment.updateOne(
            { _id: pay._id },
            {
              $set: {
                needsEnrollment: false,
                lastEnrollmentError: null,
                lastEnrollmentRetryAt: new Date(),
              },
            }
          );

          recovered++;

          console.log(
            "[RECOVERY SUCCESS]",
            {
              paymentId: String(pay._id),
            }
          );

        } else {

          await Payment.updateOne(
            { _id: pay._id },
            {
              $inc: {
                enrollmentRetryCount: 1,
              },
              $set: {
                lastEnrollmentRetryAt: new Date(),
                lastEnrollmentError:
                  "Enrollment recovery retry failed",
              },
            }
          ).catch(() => {});

          failed++;

          console.error(
            "[RECOVERY FAILED]",
            {
              paymentId: String(pay._id),
            }
          );
        }

      } catch (err) {

        await Payment.updateOne(
          { _id: pay._id },
          {
            $inc: {
              enrollmentRetryCount: 1,
            },
            $set: {
              lastEnrollmentRetryAt: new Date(),
              lastEnrollmentError:
                err?.message ||
                "Enrollment recovery exception",
            },
          }
        ).catch(() => {});

        failed++;

        console.error(
          "[RECOVERY EXCEPTION]",
          {
            paymentId: String(pay._id),
            error: err?.message,
          }
        );
      }
    }

    console.log(
      "[enrollmentRecoveryJob] completed",
      {
        processed,
        recovered,
        failed,
      }
    );

  } catch (e) {

    console.error(
      "[enrollmentRecoveryJob] fatal error:",
      e?.message
    );
  }
}