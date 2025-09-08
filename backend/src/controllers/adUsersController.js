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

  // Determine organisation scope
  let scopeOrgId = actor?.orgId || null;
  if (actor?.role === 'superadmin') {
    scopeOrgId = req.body?.orgId || null;
    if (!scopeOrgId) return res.status(400).json({ ok:false, message:"orgId is required for superadmin" });
  }
  if (!scopeOrgId) return res.status(403).json({ ok:false, message:"No org" });

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.json({ created: 0, updated: 0, total: 0, skipped: [] });

  const HEX24 = /^[0-9a-fA-F]{24}$/;
  const isEmail = (s) => /\S+@\S+\.\S+/.test(String(s||''));
  const truthy  = (v) => /^(true|1|yes|y)$/i.test(String(v||'').trim());
  const normRole = (v) => {
    const r = String(v||'').toLowerCase().trim();
    return (r==='vendor' || r==='student') ? r : 'student';
  };
  const normStatus = (v) => {
    const s = String(v||'').toLowerCase().trim();
    return ['active','disabled'].includes(s) ? s : undefined;
  };
  const normMethod = (v) => {
    const s = String(v||'').toLowerCase().trim();
    if (!s) return undefined;
    if (s === 'email' || s === 'email_otp' || s === 'otp') return 'otp';
    if (s === 'totp' || s === 'auth' || s === 'authenticator') return 'totp';
    return undefined;
  };

  // Prefetch admins in this org for managerRef/email/id lookup and fallback
  const admins = await User.find({ role: 'admin', orgId: scopeOrgId })
    .select({ _id:1, email:1, name:1, orgId:1, status:1, createdAt:1 }).lean();
  const adminById = new Map(admins.map(a => [String(a._id), a]));
  const adminByEmail = new Map(admins.map(a => [String(a.email).toLowerCase(), a]));
  // First active admin fallback
  let fallbackAdmin = admins.filter(a => a.status === 'active')
                            .sort((a,b) => (a.createdAt > b.createdAt ? 1 : -1))[0] || null;

  const resolveManager = (ref) => {
    if (!ref) return null;
    if (isEmail(ref)) return adminByEmail.get(String(ref).toLowerCase()) || null;
    if (HEX24.test(String(ref))) return adminById.get(String(ref)) || null;
    return null;
  };

  let created = 0, updated = 0;
  const skipped = [];

  for (const raw0 of rows) {
    const raw = { ...raw0 };
    const email = String(raw.email || '').trim().toLowerCase();
    if (!email || !isEmail(email)) { skipped.push({ email, reason:'invalid_email' }); continue; }

    const roleIn = normRole(raw.role);
    // store as 'orguser' for students; vendors stay 'vendor'
    const finalRole = roleIn === 'student' ? 'orguser' : 'vendor';
    const name = raw.name || undefined;
    const status = normStatus(raw.status) || (finalRole === 'orguser' ? 'active' : undefined);

    // MFA
    const mfaRequired = ('mfaRequired' in raw) ? truthy(raw.mfaRequired) :
                        ('mfa' in raw && typeof raw.mfa === 'object' && 'required' in raw.mfa) ? !!raw.mfa.required :
                        true; // default ON for both vendor and learners in admin portal
    const mfaMethod = normMethod(raw.mfaMethod || raw?.mfa?.method) || (mfaRequired ? (finalRole === 'vendor' ? 'totp' : 'otp') : null);

    // Manager: explicit managerRef → that admin; else fallback to current actor; else first active admin
    let managerDoc = resolveManager(raw.managerRef) || null;
    if (!managerDoc && actor?.role === 'admin' && String(actor.orgId) === String(scopeOrgId)) {
      managerDoc = { _id: actor.sub || actor._id || actor.id, email: actor.email, orgId: scopeOrgId };
    }
    if (!managerDoc) managerDoc = fallbackAdmin;
    if (!managerDoc) { skipped.push({ email, reason:'no_manager_in_org' }); continue; }

    const existing = await User.findOne({ email });

    // --- CREATE ---
    if (!existing) {
      const plain = (finalRole === 'vendor' && raw.password && String(raw.password).length >= 8)
        ? String(raw.password)
        : (crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi,'').slice(0,12) + "9!");
      const passwordHash = await bcrypt.hash(plain, 12);

      const doc = await User.create({
        email,
        name: name || null,
        role: finalRole,
        status: status || (finalRole === 'vendor' ? 'active' : 'active'),
        orgId: scopeOrgId,
        invitedBy: actor.sub || actor._id || actor.id || null,
        managerId: managerDoc?._id || null,
        isVerified: false, // flips true after first successful MFA/login
        passwordHash,
        mfa: mfaRequired
          ? { required:true, method: (mfaMethod || 'otp'), totpSecretHash:null, totpSecretEnc:{ iv:null, ct:null, tag:null }, emailOtp:null }
          : { required:false, method:null, totpSecretHash:null, totpSecretEnc:{ iv:null, ct:null, tag:null }, emailOtp:null },
      });

      // Credentials email
      try {
        const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
        const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
        const org = await Organization.findById(scopeOrgId).select("name").lean();
        await sendStaffCredentialsEmail(email, {
          role: roleIn, // public-facing: 'student' or 'vendor'
          signinUrl: signInUrl,
          email,
          password: plain,
          mfaMethod: doc.mfa.method,
          mfaRequired: !!doc.mfa.required,
          orgName: org?.name,
          adminName: actor?.name || actor?.email,
        });
      } catch {}

      created++;
      continue;
    }

    // --- UPDATE ---
    if (String(existing.orgId || '') !== String(scopeOrgId)) { skipped.push({ email, reason:'different_org' }); continue; }
    if (!['vendor','orguser'].includes(existing.role)) { skipped.push({ email, reason:'role_not_allowed' }); continue; }

    let changed = false;
    if (name !== undefined && existing.name !== name) { existing.name = name; changed = true; }
    if (status !== undefined && existing.status !== status) { existing.status = status; changed = true; }

    // Allow vendor<->student flips via CSV
    if (existing.role !== finalRole) { existing.role = finalRole; changed = true; }

    // Update manager if resolvable
    if (managerDoc && String(existing.managerId || '') !== String(managerDoc._id)) {
      existing.managerId = managerDoc._id; changed = true;
    }

    // Password (only honored for vendor; ignored for learners)
    if (finalRole === 'vendor' && raw.password && String(raw.password).length >= 8) {
      existing.passwordHash = await bcrypt.hash(String(raw.password), 12);
      changed = true;
    }

    // MFA
    if (mfaRequired !== undefined || mfaMethod !== undefined) {
      existing.mfa = mfaRequired
        ? { required:true, method: (mfaMethod || 'otp'), totpSecretHash: existing.mfa?.totpSecretHash || null, totpSecretEnc: existing.mfa?.totpSecretEnc || { iv:null, ct:null, tag:null }, emailOtp:null }
        : { required:false, method:null, totpSecretHash: existing.mfa?.totpSecretHash || null, totpSecretEnc: existing.mfa?.totpSecretEnc || { iv:null, ct:null, tag:null }, emailOtp:null };
      changed = true;
    }

    if (changed) { await existing.save(); updated++; }
  }

  return res.json({ created, updated, total: created + updated, skipped });
}