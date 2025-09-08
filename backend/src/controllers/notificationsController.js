// backend/src/controllers/notificationsController.js
import Notification from "../models/Notification.js";
import Enrollment from "../models/Enrollment.js";
import WishlistItem from "../models/WishlistItem.js";
import Progress from "../models/Progress.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { addClient, emitToUser } from "../utils/notify.js";

const DBG = process.env.DEBUG_NOTIFICATIONS !== '0';
const clog = (...args) => { if (DBG) console.log('[notify][ctrl]', ...args); };

const getUid = (actor) => String(actor?._id || actor?.id || actor?.sub || '');

function ensureUser(req, res) {
  const actor = req.user;
  if (!actor) {
    res.status(403).json({ ok: false, message: "unauthenticated" });
    return null;
  }
  return actor;
}

// GET /notifications
export async function list(req, res) {
  const actor = ensureUser(req, res);
  if (!actor) return;
  const uid = getUid(actor);
  if (!uid) return res.status(401).json({ ok: false, message: "unauthenticated (no user id)" });

  const unreadOnly = (req.query.unreadOnly || "").toString() === "true";
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10) || 20, 1), 100);

  const q = { userId: uid };
  if (unreadOnly) q.readAt = null;

  const docs = await Notification.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ ok: true, items: docs });
}

// POST /notifications/:id/read
export async function markRead(req, res) {
  const actor = ensureUser(req, res);
  if (!actor) return;
  const uid = getUid(actor);
  if (!uid) return res.status(401).json({ ok: false, message: "unauthenticated (no user id)" });

  const { id } = req.params;
  const doc = await Notification.findOne({ _id: id, userId: uid });
  if (!doc) return res.status(404).json({ ok: false, message: "not found" });

  if (!doc.readAt) {
    doc.readAt = new Date();
    await doc.save();
  }
  res.json({ ok: true });
}

// POST /notifications/:id/dismiss
export async function dismiss(req, res) {
  const actor = ensureUser(req, res);
  if (!actor) return;
  const uid = getUid(actor);
  if (!uid) return res.status(401).json({ ok: false, message: "unauthenticated (no user id)" });

  const { id } = req.params;
  clog('dismiss', { userId: uid, id });

  const doc = await Notification.findOne({ _id: id, userId: uid });
  if (!doc) return res.status(404).json({ ok: false, message: "not found" });

  if (!doc.resolvedAt) {
    doc.resolvedAt = new Date();
    await doc.save();
  }
  res.json({ ok: true });
}

// GET /notifications/stream (SSE)
export async function stream(req, res) {
  const actor = ensureUser(req, res);
  if (!actor) return;
  const uid = getUid(actor);
  if (!uid) return res.status(401).json({ ok: false, message: "unauthenticated (no user id)" });

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  clog('sse:open', { userId: uid });

  // greet and keep alive
  res.write(`event: hello\n`);
  res.write(`data: { "ok": true }\n\n`);
  const hb = setInterval(() => { try { res.write(':hb\n\n'); } catch {} }, 15000);
  res.on('close', () => { clearInterval(hb); clog('sse:close', { userId: uid }); });

  addClient(uid, res);
}

// ---------------------------------------------------------------------------
// Helper: enqueue notification (upsert "latest" for same type/object if unresolved)
// ---------------------------------------------------------------------------
export async function enqueueNotification({ userId, orgId, type, title, body, data = {}, dueAt = new Date(), recurrence = "none", maxTimes = 1, priority = "normal" }) {
  const q = { userId, type, resolvedAt: null };
  if (data?.courseId) q["data.courseId"] = data.courseId;
  if (data?.progressId) q["data.progressId"] = data.progressId;

  let doc = await Notification.findOne(q);
  if (!doc) {
    doc = await Notification.create({ userId, orgId, type, title, body, data, dueAt, recurrence, maxTimes, priority });
  } else {
    doc.title = title;
    doc.body = body;
    doc.data = data;
    doc.dueAt = dueAt;
    await doc.save();
  }

  if (doc.dueAt && doc.dueAt <= new Date()) {
    emitToUser(userId, "reminder", { id: doc._id, type: doc.type, title: doc.title, body: doc.body, data: doc.data });
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Periodic job to generate reminders based on current DB state.
// ---------------------------------------------------------------------------
export async function generatePeriodicReminders(orgId = null) {
  // 1) Incomplete progress older than 2 days → nudge daily up to 5 times
  const cutoff = new Date(Date.now() - 2*24*3600*1000);
  const q = { overallStatus: { $ne: "completed" }, updatedAt: { $lt: cutoff } };
  if (orgId) q.orgId = orgId;
  const list = await Progress.find(q).limit(500).lean();

  for (const p of list) {
    const course = await Course.findById(p.courseId).lean();
    const title = `Keep going: ${course?.title || "your course"}`;
    const body = `You haven't made progress recently. Pick up where you left off.`;
    await enqueueNotification({
      userId: p.studentId,
      orgId: p.orgId || null,
      type: "course_incomplete",
      title,
      body,
      data: { courseId: p.courseId, progressId: p._id },
      dueAt: new Date(),
      recurrence: "daily",
      maxTimes: 5,
    });
  }

  // 2) Wishlist older than 3 days and no enrollment → suggest purchase (weekly, 3 times)
  const wcut = new Date(Date.now() - 3*24*3600*1000);
  const wish = await WishlistItem.find({ createdAt: { $lt: wcut } }).limit(500).lean();

  for (const w of wish) {
    const enrolled = await Enrollment.findOne({ studentId: w.studentId, courseId: w.courseId });
    if (enrolled) continue;
    const course = await Course.findById(w.courseId).lean();
    await enqueueNotification({
      userId: w.studentId,
      orgId: w.orgId || null,
      type: "wishlist_reminder",
      title: `Ready to start "${course?.title || "this course"}"?`,
      body: `Enroll now and work toward your certificate.`,
      data: { courseId: w.courseId },
      dueAt: new Date(),
      recurrence: "weekly",
      maxTimes: 3,
    });
  }
}

// Mark certificate reminders resolved for a progress when downloaded
export async function resolveCertificateReminders(progressId, userId) {
  await Notification.updateMany(
    { userId, type: "certificate_available", "data.progressId": progressId, resolvedAt: null },
    { $set: { resolvedAt: new Date() } }
  );
}
