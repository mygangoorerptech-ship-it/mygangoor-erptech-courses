// backend/src/utils/scheduler.js
import Notification from "../models/Notification.js";
import { emitToUser } from "./notify.js";
import { generatePeriodicReminders } from "../controllers/notificationsController.js";

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

export function startScheduler() {
  const TICK_MS = Number(process.env.NOTIFY_TICK_MS || 60000);
  slog('start', { TICK_MS, recurrences: ['daily','weekly','monthly'] });

  setInterval(async () => {
    try {
      await generatePeriodicReminders();

      const now = new Date();
      const due = await Notification.find({ resolvedAt: null, dueAt: { $lte: now } }).limit(500);
      if (due.length) slog('dueCount', due.length);

      for (const n of due) {
        try {
          slog('deliver', { id: n._id, type: n.type, userId: n.userId, sentCount: n.sentCount, recurrence: n.recurrence });
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
          slog('delivered', { id: n._id, nextDueAt: n.dueAt, resolvedAt: n.resolvedAt, sentCount: n.sentCount });
        } catch (err) {
          console.error('[scheduler] deliver error', err);
        }
      }
    } catch (e) {
      console.error('[scheduler] tick error (outer):', e);
    }
  }, TICK_MS); // configurable
}
