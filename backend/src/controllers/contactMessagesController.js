import sanitizeHtml from "sanitize-html";
import ContactMessage from "../models/ContactMessage.js";
import { sendContactNotification } from "../utils/email.js";
import { badReq, sendErr } from "../utils/http.js";

const allowedFields = ["name", "email", "phone", "subject", "message", "honeypot"];
const MAX_MESSAGE = 5000;

function cleanText(val, maxLen) {
  const raw = String(val || "");
  const stripped = sanitizeHtml(raw, { allowedTags: [], allowedAttributes: {} });
  const trimmed = stripped.trim();
  return trimmed.slice(0, maxLen);
}

function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid-payload" };
  }

  const keys = Object.keys(body);
  const extra = keys.filter((k) => !allowedFields.includes(k));
  if (extra.length) {
    return { ok: false, error: "unexpected-fields", details: extra };
  }

  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 200).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const subject = cleanText(body.subject, 200);
  const message = cleanText(body.message, MAX_MESSAGE);

  if (!name) return { ok: false, error: "name-required" };
  if (!email) return { ok: false, error: "email-required" };
  if (!message) return { ok: false, error: "message-required" };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return { ok: false, error: "email-invalid" };

  return { ok: true, value: { name, email, phone, subject, message } };
}

function parseAdminEmails() {
  const raw =
    process.env.CONTACT_ADMIN_EMAILS ||
    process.env.ADMIN_EMAILS ||
    process.env.SUPERADMIN_EMAIL ||
    "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getClientIp(req) {
  const xfwd = (req.headers["x-forwarded-for"] || "").toString();
  if (xfwd) return xfwd.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

export async function submitPublic(req, res) {
  const honeypot = String(req.body?.honeypot || "").trim();
  if (honeypot) {
    return res.json({ ok: true, message: "received" });
  }

  const parsed = validatePayload(req.body);
  if (!parsed.ok) {
    return badReq(res, parsed.error, parsed.details);
  }

  const ipAddress = getClientIp(req);
  const userAgent = String(req.get("user-agent") || "").slice(0, 500);

  try {
    const doc = await ContactMessage.create({
      ...parsed.value,
      ipAddress,
      userAgent,
      status: "new",
    });

    const adminEmails = parseAdminEmails();
    if (adminEmails.length) {
      sendContactNotification(adminEmails, {
        ...parsed.value,
        submittedAt: doc.createdAt?.toISOString(),
        ipAddress,
        userAgent,
      }).catch((err) => {
        console.error("[contact] email notification failed:", err?.message || err);
      });
    } else {
      console.warn("[contact] No admin email configured (CONTACT_ADMIN_EMAILS/ADMIN_EMAILS/SUPERADMIN_EMAIL)");
    }

    return res.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    console.error("[contact] submit error:", err);
    return sendErr(res, 500, "contact-submit-failed");
  }
}

export async function listAdmin(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 20));
    const status = ["new", "read", "resolved"].includes(String(req.query.status))
      ? String(req.query.status)
      : null;
    const sort = String(req.query.sort || "new");
    const sortMap = sort === "old" ? { createdAt: 1 } : { createdAt: -1 };

    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      ContactMessage.find(where)
        .sort(sortMap)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      ContactMessage.countDocuments(where),
    ]);

    return res.json({
      rows: rows.map((r) => ({
        id: String(r._id),
        name: r.name,
        email: r.email,
        phone: r.phone,
        subject: r.subject,
        message: r.message,
        status: r.status,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    console.error("[contact] admin list error:", err);
    return sendErr(res, 500, "contact-list-failed");
  }
}

export async function getAdmin(req, res) {
  try {
    const doc = await ContactMessage.findById(req.params.id).lean();
    if (!doc) return sendErr(res, 404, "contact-not-found");
    return res.json({
      id: String(doc._id),
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      subject: doc.subject,
      message: doc.message,
      status: doc.status,
      ipAddress: doc.ipAddress,
      userAgent: doc.userAgent,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error("[contact] admin get error:", err);
    return sendErr(res, 500, "contact-get-failed");
  }
}

export async function patchAdmin(req, res) {
  const status = String(req.body?.status || "").toLowerCase();
  if (!["new", "read", "resolved"].includes(status)) {
    return badReq(res, "invalid-status");
  }

  try {
    const doc = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).lean();
    if (!doc) return sendErr(res, 404, "contact-not-found");
    return res.json({ ok: true, status: doc.status });
  } catch (err) {
    console.error("[contact] admin patch error:", err);
    return sendErr(res, 500, "contact-update-failed");
  }
}
