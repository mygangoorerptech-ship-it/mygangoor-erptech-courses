// backend/src/controllers/adUsersController.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { sendInvitationEmail, sendStaffCredentialsEmail } from "../utils/email.js";
import Organization from "../models/Organization.js";

function sanitize(u) {
    if (!u) return u;
    const obj = u.toObject ? u.toObject() : u;
    delete obj.passwordHash;
    return Object.assign(obj, { id: String(obj._id) });
}

// GET /ad/users
export async function list(req, res) {
    const actor = req.user;
    if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

  const { q, role = 'all', status = 'all', showUnverified } = (req.query || {});
  const and = [
    { orgId: actor.orgId },
    { role: role === 'all' ? { $in: ['vendor', 'student'] } : role },
  ];
  if (status !== 'all') and.push({ status });
  if (q) and.push({ $or: [
    { name:  { $regex: String(q), $options: 'i' } },
    { email: { $regex: String(q), $options: 'i' } },
  ]});
  // Match SA behavior: by default hide unverified (but keep back-compat where field missing)
  if (String(showUnverified) !== 'true') {
    and.push({ $or: [ { isVerified: { $exists: false } }, { isVerified: true } ] });
  }
  const where = { $and: and };
  const users = await User.find(where).sort({ createdAt: -1 }).lean();
    return res.json(users.map(sanitize));
}

// POST /ad/users
export async function create(req, res) {
    const actor = req.user;
    if (!actor?.orgId) return res.status(403).json({ ok: false, message: "No org" });

    const { email, name, role, mfa } = req.body || {};
    if (!email || !role) return res.status(400).json({ ok: false, message: "email and role required" });
    if (!['vendor', 'student'].includes(role)) return res.status(400).json({ ok: false, message: "invalid role" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ ok: false, message: "User already exists" });

    if (role === 'vendor') {
        const password = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, '').slice(0, 12) + "9!";
        const passwordHash = await bcrypt.hash(password, 12);
        const doc = await User.create({
            email, name: name || null,
            role: 'vendor',
            status: 'active',
            orgId: actor.orgId,
            managerId: actor.sub || actor._id || actor.id || null,
      invitedBy: actor.sub || actor._id || actor.id || null,
      mfa: { required: true, method: (mfa?.method === 'totp' ? 'totp' : 'otp') }, // vendor -> MFA required
      isVerified: false,   // verified on first MFA success
            passwordHash,
        });
    // credential email (object shape)
    const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
    const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
  // Resolve pretty organization name for the email (use id only as a fallback if name missing)
  let orgName;
  try {
    const org = await Organization.findById(actor.orgId).select("name").lean();
    orgName = org?.name;
  } catch {}
    try {
      await sendStaffCredentialsEmail(email, {
        role: 'vendor',
        signinUrl: signInUrl,
        email,
        password,
        mfaMethod: doc.mfa.method,
        mfaRequired: true,
        orgName,
        adminName: req.user?.name || req.user?.email,
      });
    } catch {}
        return res.json(sanitize(doc));
    }

    // student → invite flow (to match SignUp finishing step)
    // student → PRO flow: create now with generated password, email credentials, MFA per payload
    const password = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, '').slice(0, 12) + "9!";
    const passwordHash = await bcrypt.hash(password, 12);
    const doc = await User.create({
        email, name: name || null,
        role: 'student',
        status: 'active',
        orgId: actor.orgId,
    invitedBy: actor.sub || actor._id || actor.id || null,
    managerId: actor.sub || actor._id || actor.id || null,   // supervising admin
        mfa: mfa?.required ? { required: true, method: mfa.method || 'otp' } : { required: false, method: null },
        isVerified: false,
        passwordHash,
    });
  const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
  const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
  try {
    await sendStaffCredentialsEmail(email, {
      role: 'student',
      signinUrl: signInUrl,
      email,
      password,
      mfaMethod: doc.mfa.method,
      mfaRequired: !!doc.mfa.required,
      orgName,
      adminName: req.user?.name || req.user?.email,
    });
  } catch {}
    return res.json(sanitize(doc));
}

// PATCH /ad/users/:id
export async function patch(req, res) {
    const actor = req.user;
    const { id } = req.params;
    if (!actor?.orgId) return res.status(403).json({ ok: false });

    const u = await User.findOne({ _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'student'] } });
    if (!u) return res.status(404).json({ ok: false });

    const patch = {};
    if (typeof req.body?.name === 'string') patch.name = req.body.name;
    // For safety, ignore email/role/orgId changes here.

    if (req.body?.mfa) {
        const { required, method } = req.body.mfa;
        patch['mfa'] = required ? { required: true, method: method || 'otp' } : { required: false, method: null };
    }

    const updated = await User.findByIdAndUpdate(id, { $set: patch }, { new: true });
    return res.json(sanitize(updated));
}

// POST /ad/users/:id/status
export async function setStatus(req, res) {
    const actor = req.user;
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['active', 'disabled'].includes(status)) return res.status(400).json({ ok: false });

    const u = await User.findOneAndUpdate(
        { _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'student'] } },
        { $set: { status } },
        { new: true }
    );
    if (!u) return res.status(404).json({ ok: false });
    return res.json(sanitize(u));
}

// (Optional) POST /ad/users/:id/role — only vendor<->student switches
export async function setRole(req, res) {
    const actor = req.user;
    const { id } = req.params;
    const { role } = req.body || {};
    if (!['vendor', 'student'].includes(role)) return res.status(400).json({ ok: false });

    const u = await User.findOneAndUpdate(
        { _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'student'] } },
        { $set: { role } },
        { new: true }
    );
    if (!u) return res.status(404).json({ ok: false });
    return res.json(sanitize(u));
}

// DELETE /ad/users/:id
export async function remove(req, res) {
    const actor = req.user;
    const { id } = req.params;

    const u = await User.findOne({ _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'student'] } });
    if (!u) return res.status(404).json({ ok: false });

    await User.deleteOne({ _id: id });
    return res.json({ ok: true });
}

// POST /ad/users/bulk-upsert
export async function bulkUpsert(req, res) {
    const actor = req.user;
    if (!actor?.orgId) return res.status(403).json({ ok: false });

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let created = 0, updated = 0;

    for (const r of rows) {
        const email = (r.email || '').toLowerCase().trim();
        const name = (r.name || '').trim() || null;
        const role = (r.role || '').toLowerCase();
        if (!email || !['vendor', 'student'].includes(role)) continue;

        const existing = await User.findOne({ email });
        if (existing) {
            // only allow update within same org and role in allowed set
            if (String(existing.orgId) !== String(actor.orgId) || !['vendor', 'student'].includes(existing.role)) continue;
            const patch = {};
            if (name) patch['name'] = name;
            await User.updateOne({ _id: existing._id }, { $set: patch });
            updated++;
            continue;
        }

        if (role === 'vendor') {
            const password = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, '').slice(0, 12) + "9!";
            const passwordHash = await bcrypt.hash(password, 12);
            await User.create({
                email, name, role: 'vendor', status: 'active',
                orgId: actor.orgId,
                managerId: actor.sub || actor._id || actor.id || null,
                mfa: { required: false, method: null }, isVerified: true,
                passwordHash,
            });
            try { await sendStaffCredentialsEmail(email, password); } catch { }
            created++;
        } else {
            const token = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
            await Invitation.create({
                email, role: 'student', orgId: actor.orgId, mfa: { required: false, method: null },
                tokenHash, expiresAt, invitedBy: actor.sub || actor._id || actor.id || null, managerId: null,
            });
            const appUrl = (process.env.PUBLIC_APP_URL || "http://localhost:5173").split(",")[0];
            const link = `${appUrl.replace(/\/$/, '')}/signup?invite=${token}`;
            try { await sendInvitationEmail(email, link); } catch { }
            created++;
        }
    }

    return res.json({ created, updated, total: created + updated });
}
