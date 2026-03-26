import AuditLog from "../models/AuditLog.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

// GET /api/audit/logs      (admin/teacher — org-scoped server-side by middleware)
// GET /api/sa/audit/logs   (super-admin — global)
export async function list(req, res) {
  try {
    const { userId, action, from, to } = req.query || {};

    const page  = Math.max(1, parseInt(req.query.page  || "1",  10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit || String(DEFAULT_LIMIT), 10)));
    const skip  = (page - 1) * limit;

    // ── Build filter ──────────────────────────────────────────────────────────
    const filter = {};

    if (userId) filter.userId = userId;
    if (action)  filter.action = action;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    // ── Query ─────────────────────────────────────────────────────────────────
    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email role")
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    // ── Normalize response shape ────────────────────────────────────────────────
    // Attach populated user fields to top-level for easy consumption by UI
    const normalized = items.map((doc) => {
      const actor = doc.userId || {};
      return {
        id:          String(doc._id),
        action:      doc.action,
        ip:          doc.ip,
        ua:          doc.ua,
        meta:        doc.meta,
        createdAt:   doc.createdAt,
        actorId:     actor._id ? String(actor._id) : null,
        actorEmail:  actor.email  || null,
        actorName:   actor.name   || null,
        actorRole:   actor.role   || null,
      };
    });

    return res.json({ items: normalized, total, page, limit });
  } catch (err) {
    console.error("[auditController] list error:", err?.message);
    return res.status(500).json({ ok: false, message: "Failed to fetch audit logs" });
  }
}
