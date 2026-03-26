// backend/src/controllers/saUsersController.js
import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { sendInvitationEmail, sendOtpEmail, sendStaffCredentialsEmail } from "../utils/email.js";
import Organization from "../models/Organization.js";
import AuditLog from "../models/AuditLog.js";

const hash = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

function sanitize(u) {
  if (!u) return u;
  const obj = u.toObject ? u.toObject() : u;
  delete obj.passwordHash;
  return Object.assign(obj, { id: String(obj._id) });
}

/** Tolerant orgId normalizer for list/filter endpoints */
const HEX24 = /^[0-9a-fA-F]{24}$/;
function normalizeOrgId(input) {
  if (input === undefined) return undefined;              // no filter
  if (input === null || input === "" || input === "global" || input === "null") return null; // global
  let v = input;
  if (typeof v === "object" && v) v = v.value || v._id || v.$oid || v.id || v.toString?.();
  const s = String(v);
  if (s === "[object Object]") return null;
  return HEX24.test(s) ? s : null;
}


// GET /sa/users
export async function list(req, res) {
  const { q = "", role = "all", status = "all", orgId, verified } = req.query || {};

  const and = [];
  if (q) {
    and.push({
      $or: [
        { name:  { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    });
  }
  // Map student <-> orguser for filtering (DB stores orguser)
if (role && role !== "all") {
  if (role === "student" || role === "orguser") {
    and.push({ role: { $in: ["student", "orguser"] } });
  } else {
    and.push({ role });
  }
}

  if (status && status !== "all") and.push({ status });

  // Tolerant org filter
  const oid = normalizeOrgId(orgId);
  if (oid === undefined) {
    // no org filter
  } else if (oid === null) {
    and.push({ orgId: null });          // global users
  } else {
    and.push({ orgId: oid });           // specific org
  }

  // Hide unverified by default (keep docs where field is missing)
  // if (verified !== "all") {
  //   and.push({ $or: [{ isVerified: { $exists: false } }, { isVerified: true }] });
  // }

  // show all users including unverified

  const where = and.length ? { $and: and } : {};

  // ETag / data-version
  const count   = await User.countDocuments(where);
  const lastDoc = await User.find(where).sort({ updatedAt: -1 }).limit(1).select({ updatedAt: 1 }).lean();
  const last    = lastDoc?.[0]?.updatedAt ? new Date(lastDoc[0].updatedAt).getTime() : 0;
  const vKey    = `${count}:${last}:${role}:${status}:${oid ?? "any"}:${verified || "default"}:${hash(q)}`;
  const etag    = `W/"sausers-${vKey}"`;
  res.setHeader("ETag", etag);
  res.setHeader("X-Data-Version", vKey);
  if ((req.headers["if-none-match"] || "") === etag) {
    return res.status(304).end();
  }

  // Data
  const rows = await User.find(where).sort({ createdAt: -1 }).lean();

  // Resolve org names
  const orgIds = [...new Set(rows.map(r => r.orgId).filter(Boolean))];
  let nameById = {};
  if (orgIds.length) {
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select({ _id: 1, name: 1 })
      .lean();
    nameById = Object.fromEntries(orgs.map(o => [String(o._id), o.name]));
  }

  return res.json(
    rows.map(r => ({
      ...r,
      id: String(r._id),
      orgId: r.orgId ? String(r.orgId) : null, // normalize to string|null for client
      orgName: r.orgId ? nameById[String(r.orgId)] || undefined : undefined,
    }))
  );
}

// POST /sa/users
export async function create(req, res) {
  const actor = req.user || {};
  // Determine the actor's primary role; prefer `role` but fall back to the first entry in `roles`.
  let actorRole = actor?.role;
  if (!actorRole && Array.isArray(actor?.roles) && actor.roles.length) {
    actorRole = actor.roles[0];
  }
  actorRole = (actorRole || "").toString().toLowerCase();

  if (!actorRole || actorRole !== "superadmin") {
    return res.status(403).json({ ok: false });
  }

  const {
    name,
    email,
    role = "student",
    status, // ignored for admin/teacher at creation
    orgId,
    mfa = { required: false, method: null },
    managerId,
    password, // for admin/teacher direct creation
  } = req.body || {};

  if (!email) return res.status(400).json({ ok: false, message: "Email required" });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ ok: false, message: "User already exists" });

  // Prefer JWT subject; fall back to any legacy fields if present
  const actorId = actor.sub || actor._id || actor.id || actor.uid || null;

  // Helper for secure random password when none provided (admin/teacher)
  const genPassword = () =>
    crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, '').slice(0, 12) + "9!";

  // Branch by role
  if (role === "admin" || role === "teacher") {
    // Direct account (no signup); verification happens after first MFA success
    const plain = password && String(password).length >= 8 ? String(password) : genPassword();
    const passwordHash = await bcrypt.hash(plain, 12);
    const initialStatus = status === "disabled" ? "disabled" : "active";

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      status: initialStatus,             // ⬅ status is managed by superadmin
      isVerified: false,                 // ⬅ new: hidden until first MFA completion
      orgId: orgId || null,
      invitedBy: actorId,
      managerId: role === "teacher" ? (managerId || null) : null,
      mfa: {
        required: true,                  // ⬅ enforced for admin/teacher
        method: mfa?.method === "totp" ? "totp" : "otp",
        totpSecretHash: null,
        totpSecretEnc: { iv: null, ct: null, tag: null },
        emailOtp: null,
      },
    });

    // Email with credentials + sign-in link (NOT signup)
    const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
    const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
    let orgName;
    if (orgId) {
      const org = await Organization.findById(orgId).select("name").lean();
      orgName = org?.name;
    }
    let emailSent = false;
    try {
      await sendStaffCredentialsEmail(email, {
        role,
        signinUrl: signInUrl,
        email,
        password: plain,
        mfaMethod: user.mfa.method || "otp",
        orgName,
      });
      emailSent = true;
    } catch (err) {
      console.warn("[saUsers.create] sendStaffCredentialsEmail failed:", err?.message);
    }

    return res.status(201).json({ ...sanitize(user), emailSent });
  }

  // STUDENT: direct account + MFA policy + email credentials (no signup page)
  if (role === "student") {
    // prefer explicit adminId/managerId from request
    const chosenAdminId = req.body.adminId || req.body.managerId;
    if (!chosenAdminId) {
      return res.status(400).json({ ok:false, message:"Admin required for student creation" });
    }

    // find admin and derive orgId
    const adminDoc = await User.findOne({ _id: chosenAdminId, role: "admin" });
    if (!adminDoc) return res.status(400).json({ ok:false, message:"Selected admin not found" });
    if (!adminDoc.orgId) return res.status(400).json({ ok:false, message:"Selected admin has no organization" });

    // generate password
    const plain = crypto
      .randomBytes(10).toString("base64")
      .replace(/[^a-z0-9]/gi, "").slice(0, 12) + "9!";
    const passwordHash = await bcrypt.hash(plain, 12);

    // NEW: students start unverified; will flip to true on first successful login/MFA
    const user = await User.create({
      name: name || null,
      email,
      role: "orguser",
      status: "active",
      orgId: adminDoc.orgId,
      invitedBy: actor.sub || actor._id || actor.id || actor.uid || null, // FIX: record creator
      managerId: adminDoc._id,                                            // supervising admin
      isVerified: false,                                                  // FIX: start false
      passwordHash,
      mfa: {
        required: !!mfa?.required,
        method: mfa?.required ? (mfa?.method === "totp" ? "totp" : "otp") : null,
        totpSecretHash: null,
        totpSecretEnc: { iv: null, ct: null, tag: null },
        emailOtp: null,
      },
    });

    // email credentials (CORRECT CALL SIGNATURE)
    const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
    const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;

    let orgName;
    if (adminDoc.orgId) {
      const org = await Organization.findById(adminDoc.orgId).select("name").lean();
      orgName = org?.name;
    }

    try {
      await sendStaffCredentialsEmail(email, {
        role: "student",
        signinUrl: signInUrl,
        email,
        password: plain,
        mfaMethod: user.mfa.method,          // 'otp' | 'totp' | null
        mfaRequired: !!user.mfa.required,    // ensure correct wording
        orgName,
        adminName: adminDoc.name || adminDoc.email,
      });
    } catch {}

    return res.status(201).json(sanitize(user));
  }

  // For completeness: allow creating superadmin via API if needed
  if (role === "superadmin") {
    const plain = password && String(password).length >= 8 ? String(password) : genPassword();
    const passwordHash = await bcrypt.hash(plain, 12);
    const user = await User.create({
      name, email, role: "superadmin", status: "active", orgId: null,
      isVerified: true,
      passwordHash,
      mfa: { required: true, method: "otp", totpSecretHash: null, totpSecretEnc: { iv: null, ct: null, tag: null }, emailOtp: null },
      invitedBy: actorId,
    });
    return res.status(201).json(sanitize(user));
  }

  return res.status(400).json({ ok: false, message: "Unsupported role" });
}

// PATCH /sa/users/:id
export async function patch(req, res) {
  const { id } = req.params;
  const { name, email, role, status, orgId, managerId, mfa, password } = req.body || {};
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false });

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (status !== undefined) user.status = status;
  if (orgId !== undefined) user.orgId = orgId || null;
  if (managerId !== undefined) user.managerId = managerId || null;

  if (mfa && typeof mfa === "object") {
    user.mfa = {
      required: !!mfa.required,
      method: mfa.required ? (mfa.method === "totp" ? "totp" : "otp") : null,
      totpSecretHash: null,
      totpSecretEnc: user.mfa?.totpSecretEnc || { iv: null, ct: null, tag: null },
      emailOtp: null,
    };
  }
  if (password && String(password).length >= 8) {
    user.passwordHash = await bcrypt.hash(String(password), 12);
  }
  await user.save();
  return res.json(sanitize(user));
}

// POST /sa/users/:id/status
export async function setStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!["active", "disabled"].includes(status)) return res.status(400).json({ ok: false });
  const user = await User.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!user) return res.status(404).json({ ok: false });
  return res.json(sanitize(user));
}

// POST /sa/users/:id/role
export async function setRole(req, res) {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!["superadmin", "admin", "teacher", "student", "orgadmin", "orguser"].includes(role)) {
    return res.status(400).json({ ok: false });
  }
  const user = await User.findByIdAndUpdate(id, { $set: { role } }, { new: true });
  if (!user) return res.status(404).json({ ok: false });
  // fire-and-forget audit — never blocks the response
  const actorId = req.user?._id || req.user?.sub || req.user?.id;
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  AuditLog.create({
    userId:  actorId || user._id,
    action:  "role_change",
    ip,
    ua:      req.get("User-Agent") || "",
    meta:    { targetUserId: String(user._id), newRole: role },
  }).catch((e) => console.error("[audit] role_change write failed:", e?.message));
  return res.json(sanitize(user));
}

// DELETE /sa/users/:id
export async function remove(req, res) {
  const { id } = req.params;
  await User.deleteOne({ _id: id });
  return res.json({ ok: true });
}

// POST /sa/users/bulk-upsert
export async function bulkUpsert(req, res) {
  const actor = req.user || {};
  let actorRole = actor?.role;
  if (!actorRole && Array.isArray(actor?.roles) && actor.roles.length) actorRole = actor.roles[0];
  actorRole = (actorRole || "").toString().toLowerCase();
  if (actorRole !== "superadmin") return res.status(403).json({ ok: false, message: "Forbidden" });

  const actorId = actor.sub || actor._id || actor.id || actor.uid || null;
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.json({ created: 0, updated: 0, total: 0, skipped: [] });

  // ---- helpers -------------------------------------------------------------
  const isHex24 = (s) => typeof s === 'string' && HEX24.test(s);
  const isEmail = (s) => /\S+@\S+\.\S+/.test(String(s||''));
  const normMethod = (v) => {
    const s = String(v||'').toLowerCase().trim();
    if (!s) return undefined;
    if (s === 'email' || s === 'email_otp' || s === 'otp') return 'otp';
    if (s === 'totp' || s === 'auth' || s === 'authenticator') return 'totp';
    return undefined;
  };
  const normRole = (v) => {
    const r = String(v||'').toLowerCase().trim();
    if (r === 'orguser') return 'student';
    return ['superadmin','admin','teacher','student'].includes(r) ? r : 'student';
  };
  const normStatus = (v) => {
    const s = String(v||'').toLowerCase().trim();
    return ['active','disabled'].includes(s) ? s : undefined;
  };
  const truthy = (v) => /^(true|1|yes|y)$/i.test(String(v||'').trim());

  // ---- collect refs for bulk prefetch -------------------------------------
  const orgIds = new Set();
  const orgCodes = new Set();
  const orgNames = new Set();
  const orgDomains = new Set();

  const adminEmails = new Set();
  const adminIds = new Set();
  const managerEmails = new Set();
  const managerIds = new Set();

  for (const raw of rows) {
    const orgId = raw.orgId || raw.org_id;
    const org = raw.org || null;
    const orgCode = raw.orgCode || raw.org_code;
    const orgName = raw.orgName || raw.org_name;
    const orgDomain = raw.orgDomain || raw.org_domain;

    if (orgId && isHex24(orgId)) orgIds.add(String(orgId));
    if (org && isHex24(org)) orgIds.add(String(org));
    if (orgCode) orgCodes.add(String(orgCode));
    if (orgName) orgNames.add(String(orgName).toLowerCase());
    if (orgDomain) orgDomains.add(String(orgDomain).toLowerCase());

    const adminRef = raw.adminRef || raw.admin || raw.admin_email || raw.admin_email || raw.admin_id || raw.adminid;
    if (adminRef) {
      if (isEmail(adminRef)) adminEmails.add(String(adminRef).toLowerCase());
      else if (isHex24(adminRef)) adminIds.add(String(adminRef));
    }
    const managerRef = raw.managerRef || raw.manager || raw.manager_email || raw.manager_id || raw.managerid;
    if (managerRef) {
      if (isEmail(managerRef)) managerEmails.add(String(managerRef).toLowerCase());
      else if (isHex24(managerRef)) managerIds.add(String(managerRef));
    }
  }

  // ---- prefetch orgs & admins in one shot ---------------------------------
  const orgOr = [];
  if (orgIds.size) orgOr.push({ _id: { $in: [...orgIds] } });
  if (orgCodes.size) orgOr.push({ code: { $in: [...orgCodes] } });
  if (orgNames.size) orgOr.push({ name: { $in: [...orgNames].map(s => new RegExp(`^${s}$`, 'i')) } });
  if (orgDomains.size) orgOr.push({ domain: { $in: [...orgDomains].map(s => new RegExp(`^${s}$`, 'i')) } });
  const orgs = orgOr.length ? await Organization.find({ $or: orgOr }).select({ _id:1, code:1, name:1, domain:1 }).lean() : [];

  const orgById = new Map(orgs.map(o => [String(o._id), o]));
  const orgByCode = new Map(orgs.filter(o => o.code).map(o => [String(o.code), o]));
  const orgByName = new Map(orgs.map(o => [String(o.name).toLowerCase(), o]));
  const orgByDomain = new Map(orgs.filter(o => o.domain).map(o => [String(o.domain).toLowerCase(), o]));

  const adminOr = [];
  if (adminIds.size) adminOr.push({ _id: { $in: [...adminIds] } });
  if (adminEmails.size) adminOr.push({ email: { $in: [...adminEmails] } });
  if (managerIds.size) adminOr.push({ _id: { $in: [...managerIds] } });
  if (managerEmails.size) adminOr.push({ email: { $in: [...managerEmails] } });

  const adminDocs = adminOr.length
    ? await User.find({ role: 'admin', $or: adminOr }).select({ _id:1, email:1, name:1, orgId:1, status:1, createdAt:1 }).lean()
    : [];

  const adminById = new Map(adminDocs.map(a => [String(a._id), a]));
  const adminByEmail = new Map(adminDocs.map(a => [String(a.email).toLowerCase(), a]));

  // build "first active admin per org" map (for fallbacks)
  const seenOrgIds = new Set(orgs.map(o => String(o._id)));
  for (const a of adminDocs) if (a.orgId) seenOrgIds.add(String(a.orgId));
  const fallbackAdmins = await User.find({
    role: 'admin', status: 'active',
    orgId: { $in: [...seenOrgIds] }
  }).select({ _id:1, email:1, name:1, orgId:1, createdAt:1 }).lean();
  const firstActiveAdminByOrg = new Map();
  for (const a of fallbackAdmins) {
    const key = String(a.orgId);
    const cur = firstActiveAdminByOrg.get(key);
    if (!cur || (cur.createdAt > a.createdAt)) firstActiveAdminByOrg.set(key, a);
  }

  const resolveOrgId = (raw) => {
    const orgId = raw.orgId || raw.org_id;
    const org = raw.org;
    const orgCode = raw.orgCode || raw.org_code;
    const orgName = raw.orgName || raw.org_name;
    const orgDomain = raw.orgDomain || raw.org_domain;

    if (orgId && isHex24(orgId) && orgById.get(String(orgId))) return String(orgId);
    if (org && isHex24(org) && orgById.get(String(org))) return String(org);

    if (orgCode && orgByCode.get(String(orgCode))) return String(orgByCode.get(String(orgCode))._id);
    if (orgName && orgByName.get(String(orgName).toLowerCase())) return String(orgByName.get(String(orgName).toLowerCase())._id);
    if (orgDomain && orgByDomain.get(String(orgDomain).toLowerCase())) return String(orgByDomain.get(String(orgDomain).toLowerCase())._id);

    // when CSV has literal "global" or "-" treat as null (global user)
    if (orgId === null || orgId === '' || String(orgId).toLowerCase() === 'global' || String(org||'').toLowerCase() === 'global') return null;

    return undefined; // unresolved
  };

  const resolveAdmin = (ref) => {
    if (!ref) return null;
    if (isEmail(ref)) return adminByEmail.get(String(ref).toLowerCase()) || null;
    if (isHex24(ref)) return adminById.get(String(ref)) || null;
    return null;
  };

  // ---- main upsert loop ----------------------------------------------------
  let created = 0, updated = 0;
  const skipped = [];

  for (const raw0 of rows) {
    const raw = { ...raw0 };
    const email = String(raw.email || '').trim().toLowerCase();
    if (!email || !isEmail(email)) { skipped.push({ email, reason: 'invalid_email' }); continue; }

    const role = normRole(raw.role || 'student');
    const name = raw.name || undefined;
    const status = normStatus(raw.status) || (role === 'student' ? 'active' : undefined);

    // MFA normalization
    const mfaObj = (raw.mfa && typeof raw.mfa === 'object') ? raw.mfa : {};
    const mfaRequired = ('mfaRequired' in raw) ? truthy(raw.mfaRequired) :
                        ('required' in mfaObj) ? !!mfaObj.required :
                        (role !== 'student'); // default true for admin/teacher
    const mfaMethod = normMethod(raw.mfaMethod || mfaObj.method) || (mfaRequired ? (role === 'teacher' ? 'totp' : 'otp') : null);

    // Resolve admin/manager refs
    const adminRef = raw.adminRef || raw.admin || raw.admin_email || raw.admin_id || raw.adminid || null;
    const managerRef = raw.managerRef || raw.manager || raw.manager_email || raw.manager_id || raw.managerid || null;

    const adminDoc = resolveAdmin(adminRef);
    const managerDoc = resolveAdmin(managerRef);

    // Resolve org
    let orgId = resolveOrgId(raw);
    if (orgId === undefined && adminDoc?.orgId) orgId = String(adminDoc.orgId); // derive from admin if present

    const existing = await User.findOne({ email });

    // ------ CREATE ----------------------------------------------------------
    if (!existing) {
      // Role-specific requirements & fallbacks
      if (role === 'admin' || role === 'teacher') {
        // admin/teacher can specify org directly OR inherit from manager/adminRef if present
        if (orgId === undefined && managerDoc?.orgId) orgId = String(managerDoc.orgId);
        const plain = (raw.password && String(raw.password).length >= 8) ? String(raw.password) : crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, '').slice(0, 12) + "9!";
        const passwordHash = await bcrypt.hash(plain, 12);

        // If teacher and no explicit manager, try to find one from org
        let managerId = null;
        if (role === 'teacher') {
          if (managerDoc) managerId = managerDoc._id;
          else if (orgId && firstActiveAdminByOrg.get(String(orgId))) managerId = firstActiveAdminByOrg.get(String(orgId))._id;
        }

        const user = await User.create({
          email, name, role,
          status: status || 'disabled',      // superadmin will activate as needed
          orgId: (orgId === undefined) ? null : orgId, // allow global admin/teacher if truly desired
          invitedBy: actorId,
          managerId: managerId || null,
          passwordHash,
          isVerified: false,
          mfa: {
            required: true,
            method: mfaMethod || 'otp',
            totpSecretHash: null,
            totpSecretEnc: { iv: null, ct: null, tag: null },
            emailOtp: null,
          },
        });

        // email credentials for staff
        try {
          const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
          const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
          let orgName;
          if (user.orgId) {
            const orgDoc = orgById.get(String(user.orgId)) || await Organization.findById(user.orgId).select("name").lean();
            orgName = orgDoc?.name;
          }
          await sendStaffCredentialsEmail(email, {
            role,
            signinUrl: signInUrl,
            email,
            password: plain,
            mfaMethod: user.mfa.method || "otp",
            orgName,
          });
        } catch {}
        created++;
        continue;
      }

      if (role === 'student') {
        // Prefer explicit admin (adminRef). Else fall back to first active admin in resolved org.
        let supervisingAdmin = adminDoc || null;
        if (!supervisingAdmin && orgId && firstActiveAdminByOrg.get(String(orgId))) {
          supervisingAdmin = firstActiveAdminByOrg.get(String(orgId));
        }
        if (!supervisingAdmin || !supervisingAdmin.orgId) {
          skipped.push({ email, reason: 'no_admin_or_org' });
          continue;
        }

        const plain = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, "").slice(0, 12) + "9!";
        const passwordHash = await bcrypt.hash(plain, 12);

        const user = await User.create({
          email, name,
          role: "orguser",
          status: status || "active",
          orgId: supervisingAdmin.orgId,
          invitedBy: actorId,
          managerId: supervisingAdmin._id,
          isVerified: false, // flips true on first successful MFA
          passwordHash,
          mfa: {
            required: !!mfaRequired,
            method: mfaRequired ? (mfaMethod || 'otp') : null,
            totpSecretHash: null,
            totpSecretEnc: { iv: null, ct: null, tag: null },
            emailOtp: null,
          },
        });

        try {
          const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
          const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
          const orgDoc = orgById.get(String(user.orgId)) || await Organization.findById(user.orgId).select("name").lean();
          await sendStaffCredentialsEmail(email, {
            role: "student",
            signinUrl: signInUrl,
            email,
            password: plain,
            mfaMethod: user.mfa.method,
            mfaRequired: !!user.mfa.required,
            orgName: orgDoc?.name,
            adminName: supervisingAdmin.name || supervisingAdmin.email,
          });
        } catch {}
        created++;
        continue;
      }

      // allow creating superadmin via CSV (rare)
      if (role === 'superadmin') {
        const plain = (raw.password && String(raw.password).length >= 8) ? String(raw.password) : crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, '').slice(0, 12) + "9!";
        const passwordHash = await bcrypt.hash(plain, 12);
        await User.create({
          name, email, role: "superadmin", status: "active", orgId: null,
          isVerified: true,
          passwordHash,
          invitedBy: actorId,
          mfa: { required: true, method: "otp", totpSecretHash: null, totpSecretEnc: { iv: null, ct: null, tag: null }, emailOtp: null },
        });
        created++;
        continue;
      }

      skipped.push({ email, reason: 'unsupported_role' });
      continue;
    }

    // ------ UPDATE ----------------------------------------------------------
    let changed = false;
    if (name !== undefined && existing.name !== name) { existing.name = name; changed = true; }
    if (status !== undefined && existing.status !== status) { existing.status = status; changed = true; }
    if (role && existing.role !== role) { existing.role = role; changed = true; }

    // orgId: only update when provided/derived (leave as-is if unresolved)
    if (orgId !== undefined && String(existing.orgId||'') !== String(orgId||'')) { existing.orgId = orgId || null; changed = true; }

    // manager: apply if teacher/student + resolvable
    if (role === 'teacher' || role === 'student') {
      let newManager = managerDoc || adminDoc || null;
      if (!newManager && orgId && firstActiveAdminByOrg.get(String(orgId))) newManager = firstActiveAdminByOrg.get(String(orgId));
      if (newManager && String(existing.managerId||'') !== String(newManager._id)) { existing.managerId = newManager._id; changed = true; }
    }

    // password
    if (raw.password && String(raw.password).length >= 8) {
      existing.passwordHash = await bcrypt.hash(String(raw.password), 12);
      changed = true;
    }

    // MFA
    if (mfaRequired !== undefined || mfaMethod !== undefined) {
      existing.mfa = {
        required: !!mfaRequired,
        method: !!mfaRequired ? (mfaMethod || 'otp') : null,
        totpSecretHash: existing.mfa?.totpSecretHash || null,
        totpSecretEnc: existing.mfa?.totpSecretEnc || { iv: null, ct: null, tag: null },
        emailOtp: null,
      };
      changed = true;
    }

    if (changed) { await existing.save(); updated++; }
  }

  return res.json({ created, updated, total: created + updated, skipped });
}