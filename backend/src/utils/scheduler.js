// backend/src/utils/scheduler.js
import Notification from "../models/Notification.js";
import { emitToUser } from "./notify.js";
import { generatePeriodicReminders } from "../controllers/notificationsController.js";
// C-2 fix: enrollment recovery job (runs every 5 minutes inside the scheduler tick)
import { runEnrollmentRecovery } from "../jobs/enrollmentRecoveryJob.js";
// SP-4: abandoned Razorpay order expiry job (runs every 15 minutes)
import { runPaymentExpiry } from "../jobs/paymentExpiryJob.js";

const DBG = process.env.DEBUG_NOTIFICATIONS !== '0';
const slog = (...args) => { if (DBG) console.log('[scheduler]', ...args); };

function nextTime(from, recurrence) {
  const d = new Date(from.getTime());
  if (recurrence === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (recurrence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else return null; // unknown/legacy -> stop recurring
  return d;
}

// C-2 fix: enrollment recovery runs every 2 minutes (120 000 ms). SP-6: tightened from 5 min.
// Decoupled from the notification tick so it always fires regardless of NOTIFY_TICK_MS.
const ENROLLMENT_RECOVERY_MS = 2 * 60 * 1000;

// SP-4: abandoned Razorpay order expiry runs every 15 minutes.
// Verifies each stale "pending" order against the Razorpay API before expiring.
const PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) {
    console.warn("[scheduler] already started");
    return;
  }

  schedulerStarted = true;
  const TICK_MS = Number(process.env.NOTIFY_TICK_MS || 60000);
  // slog('start', { TICK_MS, recurrences: ['daily','weekly','monthly'] });

  // C-2: start enrollment recovery on its own independent interval
  setInterval(() => {
    runEnrollmentRecovery().catch((e) =>
      console.error("[scheduler] enrollmentRecovery error:", e?.message)
    );
  }, ENROLLMENT_RECOVERY_MS);

  // SP-4: start payment expiry on its own independent interval
  setInterval(() => {
    runPaymentExpiry().catch((e) =>
      console.error("[scheduler] paymentExpiry error:", e?.message)
    );
  }, PAYMENT_EXPIRY_MS);

  setInterval(async () => {
    try {
      await generatePeriodicReminders();

      const now = new Date();
      const due = await Notification.find({ resolvedAt: null, dueAt: { $lte: now } }).limit(500);
      if (due.length) slog('dueCount', due.length);

      for (const n of due) {
        try {
          // slog('deliver', { id: n._id, type: n.type, userId: n.userId, sentCount: n.sentCount, recurrence: n.recurrence });
          emitToUser(n.userId, "reminder", { id: n._id, type: n.type, title: n.title, body: n.body, data: n.data });

          n.sentCount = (n.sentCount || 0) + 1;
          n.lastSentAt = now;

          if (n.sentCount >= (n.maxTimes || 1) || n.recurrence === "none") {
            n.resolvedAt = n.resolvedAt || now;
          } else {
            const next = nextTime(now, n.recurrence);
            if (next) n.dueAt = next;
            else n.resolvedAt = n.resolvedAt || now; // legacy/unknown (e.g., old "minutely") → stop
          }

          await n.save();
          // slog('delivered', { id: n._id, nextDueAt: n.dueAt, resolvedAt: n.resolvedAt, sentCount: n.sentCount });
        } catch (err) {
          console.error('[scheduler] deliver error:', err?.message);
        }
      }
    } catch (e) {
      console.error('[scheduler] tick error:', e?.message);
    }
  }, TICK_MS); // configurable
}
