//backend/src/controllers/adUsersController.js
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
  // Admin must have org; Superadmin may pass ?orgId=
  let scopeOrgId = actor?.orgId || null;
  if (actor?.role === 'superadmin') {
    scopeOrgId = (req.query?.orgId || req.body?.orgId || scopeOrgId) || null;
  }
  if (!scopeOrgId) return res.status(403).json({ ok: false, message: "No org" });

  const { q, role = 'all', status = 'all', showUnverified } = (req.query || {});
  // Build org‑scoped filter; treat 'student' filter as 'orguser' to list learners
  const and = [
    { orgId: scopeOrgId },
    {
      role:
        role === 'all'
          ? { $in: ['vendor', 'orguser'] }
          : role === 'student'
          ? 'orguser'
          : role,
    },
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
  let scopeOrgId = actor?.orgId || null;
  // For superadmins, the organisation must be explicitly provided.  Without an
  // organisation ID, the new student would end up with no org membership.  This
  // change forces the caller to supply orgId for superadmin-created users.
  if (actor?.role === 'superadmin') {
    scopeOrgId = req.body?.orgId || null;
    if (!scopeOrgId) {
      return res.status(400).json({ ok: false, message: "orgId is required for superadmin" });
    }
  }
  if (!scopeOrgId) return res.status(403).json({ ok:false, message:"No org" });

  const { email, name, role: inputRole, mfa } = req.body || {};
  if (!email || !inputRole) return res.status(400).json({ ok:false, message:"email and role required" });
  if (!['vendor','student'].includes(inputRole)) return res.status(400).json({ ok:false, message:"invalid role" });

  // For "student" inputs, assign the organisation-member role "orguser".
  // This keeps the learner type but records them as an organisation user for access
  // control.  Vendors remain vendors.
  const role = inputRole === 'student' ? 'orguser' : inputRole;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ ok:false, message:"User already exists" });

  // --- shared values for both branches ---
  const appBase  = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
  const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
  let orgName;
  try {
    const org = await Organization.findById(scopeOrgId).select("name").lean();
    orgName = org?.name;
  } catch {}

  if (role === 'vendor') {
    const password = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi,'').slice(0,12) + "9!";
    const passwordHash = await bcrypt.hash(password, 12);
    const doc = await User.create({
      email, name: name || null,
      role: 'vendor', status: 'active',
      orgId: scopeOrgId,
      managerId: actor.sub || actor._id || actor.id || null,
      invitedBy: actor.sub || actor._id || actor.id || null,
      mfa: { required: true, method: (mfa?.method === 'totp' ? 'totp' : 'otp') },
      isVerified: false,
      passwordHash,
    });

    let emailSent = false;
    try {
      await sendStaffCredentialsEmail(email, {
        role: 'vendor', signinUrl: signInUrl, email, password,
        mfaMethod: doc.mfa.method, mfaRequired: true,
        orgName, adminName: actor?.name || actor?.email,
      });
      emailSent = true;
    } catch (e) { console.warn("[adUsers.create] vendor email failed:", e?.message); }
    return res.json({ ...sanitize(doc), emailSent });
  }

  // organisation member (learner)
  const password = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi,'').slice(0,12) + "9!";
  const passwordHash = await bcrypt.hash(password, 12);
  const doc = await User.create({
    email,
    name: name || null,
    role,
    status: 'active',
    // Use the final role here.  For learners this will be 'orguser'.
    orgId: scopeOrgId,
    invitedBy: actor.sub || actor._id || actor.id || null,
    managerId: actor.sub || actor._id || actor.id || null,
    mfa: mfa?.required ? { required:true, method: mfa.method || 'otp' } : { required:false, method:null },
    isVerified: false,
    passwordHash,
  });

  let emailSent = false;
  try {
    await sendStaffCredentialsEmail(email, {
      // We still mention 'student' in the email to the recipient, but the actual
      // stored role is doc.role.  The public-facing term can remain 'student'
      // while the backend uses 'orguser' for access control.
      role: inputRole,
      signinUrl: signInUrl,
      email,
      password,
      mfaMethod: doc.mfa.method,
      mfaRequired: !!doc.mfa.required,
      orgName,
      adminName: actor?.name || actor?.email,
    });
    emailSent = true;
  } catch (e) {
    console.warn("[adUsers.create] student email failed:", e?.message);
  }
  return res.json({ ...sanitize(doc), emailSent });
}

// PATCH /ad/users/:id
export async function patch(req, res) {
    const actor = req.user;
    const { id } = req.params;
    if (!actor?.orgId) return res.status(403).json({ ok: false });

    const u = await User.findOne({ _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'orguser'] } });
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
        { _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'orguser'] } },
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
    const { role: inputRole } = req.body || {};
    if (!['vendor', 'student'].includes(inputRole)) return res.status(400).json({ ok: false });

    // Map 'student' to 'orguser'
    const finalRole = inputRole === 'student' ? 'orguser' : inputRole;

    const u = await User.findOneAndUpdate(
        { _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'orguser'] } },
        { $set: { role: finalRole } },
        { new: true }
    );
    if (!u) return res.status(404).json({ ok: false });
    return res.json(sanitize(u));
}

// DELETE /ad/users/:id
export async function remove(req, res) {
    const actor = req.user;
    const { id } = req.params;

    const u = await User.findOne({ _id: id, orgId: actor.orgId, role: { $in: ['vendor', 'orguser'] } });
    if (!u) return res.status(404).json({ ok: false });

    await User.deleteOne({ _id: id });
    return res.json({ ok: true });
}

// POST /ad/users/bulk-upsert
export async function bulkUpsert(req, res) {
    const actor = req.user;
    // Enforce orgId for bulk upsert.  Superadmins must specify orgId in the
    // request body; admins must belong to an organisation.  Without this
    // validation, newly created students may lack org membership.
    let scopeOrgId = actor?.orgId || null;
    if (actor?.role === 'superadmin') {
      scopeOrgId = req.body?.orgId || null;
      if (!scopeOrgId) {
        return res.status(400).json({ ok: false, message: "orgId is required for superadmin" });
      }
    }
    if (!scopeOrgId) return res.status(403).json({ ok: false });

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let created = 0, updated = 0;

    for (const r of rows) {
        const email = (r.email || '').toLowerCase().trim();
        const name = (r.name || '').trim() || null;
        const rawRole = (r.role || '').toLowerCase();
        if (!email || !['vendor', 'student'].includes(rawRole)) continue;
        // Map 'student' CSV entries to 'orguser' so that learners become organisation members
        const role = rawRole === 'student' ? 'orguser' : rawRole;

        const existing = await User.findOne({ email });
        if (existing) {
            // Only allow update within same org and allowed roles.  Note that we now
            // allow 'orguser' as a learner role instead of 'student'.
            if (String(existing.orgId) !== String(scopeOrgId) || !['vendor', 'orguser'].includes(existing.role)) continue;
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
                orgId: scopeOrgId,
                managerId: actor.sub || actor._id || actor.id || null,
                mfa: { required: false, method: null }, isVerified: true,
                passwordHash,
            });
            try { await sendStaffCredentialsEmail(email, password); } catch { }
            created++;
        } else {
            // Generate an invitation for an organisation user (learner)
            const token = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
            await Invitation.create({
                email,
                role: 'orguser',
                orgId: scopeOrgId,
                mfa: { required: false, method: null },
                tokenHash,
                expiresAt,
                invitedBy: actor.sub || actor._id || actor.id || null,
                managerId: null,
            });
            const appUrl = (process.env.PUBLIC_APP_URL || "http://localhost:5173").split(",")[0];
            const link = `${appUrl.replace(/\/$/, '')}/signup?invite=${token}`;
            try { await sendInvitationEmail(email, link); } catch { }
            created++;
        }
    }

    return res.json({ created, updated, total: created + updated });
}
