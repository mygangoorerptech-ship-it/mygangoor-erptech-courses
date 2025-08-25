// backend/src/controllers/saUsersController.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";
import { sendInvitationEmail, sendOtpEmail, sendStaffCredentialsEmail } from "../utils/email.js";
import Organization from "../models/Organization.js";

const hash = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

function sanitize(u) {
  if (!u) return u;
  const obj = u.toObject ? u.toObject() : u;
  delete obj.passwordHash;
  return Object.assign(obj, { id: String(obj._id) });
}

// GET /sa/users
export async function list(req, res) {
  const { q = "", role = "all", status = "all", orgId, verified } = req.query || {};

  const and = [];
  if (q) {
    and.push({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    });
  }
  if (role && role !== "all") and.push({ role });
  if (status && status !== "all") and.push({ status });
  if (orgId) and.push({ orgId });

  // By default, hide unverified (and keep back-compat by including docs where field is missing)
  if (verified !== "all") {
    and.push({ $or: [{ isVerified: { $exists: false } }, { isVerified: true }] });
  }

  const where = and.length ? { $and: and } : {};
  const rows = await User.find(where).sort({ createdAt: -1 }).lean();

  // collect distinct orgIds and resolve names
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
      orgName: r.orgId ? nameById[String(r.orgId)] || undefined : undefined,
    }))
  );
}

// POST /sa/users
export async function create(req, res) {
  const actor = req.user || {};
  if (!actor || actor.role !== "superadmin") return res.status(403).json({ ok: false });

  const {
    name,
    email,
    role = "student",
    status, // ignored for admin/vendor at creation
    orgId,
    mfa = { required: false, method: null },
    managerId,
    password, // for admin/vendor direct creation
  } = req.body || {};

  if (!email) return res.status(400).json({ ok: false, message: "Email required" });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ ok: false, message: "User already exists" });

  // Prefer JWT subject; fall back to any legacy fields if present
  const actorId = actor.sub || actor._id || actor.id || actor.uid || null;

  // Helper for secure random password when none provided (admin/vendor)
  const genPassword = () =>
    crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi, '').slice(0, 12) + "9!";

  // Branch by role
  if (role === "admin" || role === "vendor") {
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
      managerId: role === "vendor" ? (managerId || null) : null,
      mfa: {
        required: true,                  // ⬅ enforced for admin/vendor
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
    await sendStaffCredentialsEmail(email, {
      role,
      signinUrl: signInUrl,
      email,
      password: plain, // only ever sent here; never persisted
      mfaMethod: user.mfa.method || "otp",
      orgName,
    });

    return res.status(201).json(sanitize(user));
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
    role: "student",
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
      totpSecretHash: user.mfa?.totpSecretHash || null,
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
  if (!["superadmin", "admin", "vendor", "student", "orgadmin", "orguser"].includes(role)) {
    return res.status(400).json({ ok: false });
  }
  const user = await User.findByIdAndUpdate(id, { $set: { role } }, { new: true });
  if (!user) return res.status(404).json({ ok: false });
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
  const actorId = actor.sub || actor._id || actor.id || actor.uid || null;
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  let created = 0, updated = 0;

  for (const raw of rows) {
    const email = (raw.email || "").trim().toLowerCase();
    if (!email) continue;

    const role = raw.role || "student";
    const orgId = raw.orgId || null;
    const name = raw.name || undefined;
    const status = raw.status && ["active", "disabled"].includes(raw.status) ? raw.status : undefined;
    const mfa = raw.mfa || null;
    const pwd = raw.password;

    const existing = await User.findOne({ email });
    if (!existing) {
      if (role === "admin" || role === "vendor") {
        const plain = pwd && String(pwd).length >= 8 ? String(pwd) : undefined;
        const passwordHash = await bcrypt.hash((plain || crypto.randomUUID()), 12);
        await User.create({
          email, name, role, status: "disabled", orgId,
          invitedBy: actorId,
          managerId: role === "vendor" ? (raw.managerId || null) : null,
          passwordHash,
          isVerified: false,
          mfa: { required: true, method: mfa?.method === "totp" ? "totp" : "otp", totpSecretHash: null, totpSecretEnc: { iv: null, ct: null, tag: null }, emailOtp: null }
        });
        created++;
      } else if (role === "student") {
        // === CSV STUDENT: direct-create matching the rules ===
        // Prefer an explicit admin (adminId/managerId) or fall back to first active admin in orgId.
        const pickedAdminId = raw.adminId || raw.managerId || null;
        let adminDoc = null;
        if (pickedAdminId) {
          adminDoc = await User.findOne({ _id: pickedAdminId, role: "admin" });
        } else if (orgId) {
          adminDoc = await User.findOne({ role: "admin", status: "active", orgId }).sort({ createdAt: 1 });
        }
        if (!adminDoc || !adminDoc.orgId) continue;

        const plain = crypto.randomBytes(10).toString("base64")
          .replace(/[^a-z0-9]/gi, "").slice(0, 12) + "9!";
        const passwordHash = await bcrypt.hash(plain, 12);

        const user = await User.create({
          email, name,
          role: "student",
          status: status || "active",
          orgId: adminDoc.orgId,
          invitedBy: actorId,              // FIX
          managerId: adminDoc._id,         // FIX
          isVerified: false,               // FIX – verified on first successful login/MFA
          passwordHash,
          mfa: {
            required: !!mfa?.required,
            method: mfa?.required ? (mfa?.method === "totp" ? "totp" : "otp") : null,
            totpSecretHash: null,
            totpSecretEnc: { iv: null, ct: null, tag: null },
            emailOtp: null,
          },
        });

        const appBase = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
        const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
        let orgName;
        const org = await Organization.findById(adminDoc.orgId).select("name").lean();
        orgName = org?.name;
        try {
          await sendStaffCredentialsEmail(email, {
            role: "student",
            signinUrl: signInUrl,
            email,
            password: plain,
            mfaMethod: user.mfa.method,
            mfaRequired: !!user.mfa.required,
            orgName,
            adminName: adminDoc.name || adminDoc.email,
          });
        } catch {}
        created++;
      } else {
        // (Optional) handle any other roles if you ever add them here.
        continue;
      }

    } else {
      // patch basic fields on upsert
      if (name !== undefined) existing.name = name;
      if (status !== undefined) existing.status = status;
      if (orgId !== undefined) existing.orgId = orgId;
      if (role !== undefined) existing.role = role;
      if (pwd && String(pwd).length >= 8) {
        existing.passwordHash = await bcrypt.hash(String(pwd), 12);
      }
      if (mfa) {
        existing.mfa = {
          required: !!mfa.required,
          method: mfa.required ? (mfa.method === "totp" ? "totp" : "otp") : null,
          totpSecretHash: existing.mfa?.totpSecretHash || null,
          totpSecretEnc: existing.mfa?.totpSecretEnc || { iv: null, ct: null, tag: null },
          emailOtp: null,
        };
      }
      await existing.save();
      updated++;
    }
  }

  return res.json({ created, updated, total: created + updated });
}
