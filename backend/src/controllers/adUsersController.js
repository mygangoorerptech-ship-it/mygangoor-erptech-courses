//backend/src/controllers/adUsersController.js
import bcrypt from "bcrypt";
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
          ? { $in: ['teacher', 'orguser'] }
          : role === 'student'
          ? 'orguser'
          : role === 'teacher'
          ? 'teacher'
          : role,
    },
  ];
  if (status !== 'all') and.push({ status });
  if (q) and.push({ $or: [
    { name:  { $regex: String(q), $options: 'i' } },
    { email: { $regex: String(q), $options: 'i' } },
  ]});
  // Match SA behavior: by default hide unverified (but keep back-compat where field missing)
  // if (String(showUnverified) !== 'true') {
  //   and.push({ $or: [ { isVerified: { $exists: false } }, { isVerified: true } ] });
  // }
  const where = { $and: and };
  const users = await User.find(where).sort({ createdAt: -1 }).lean();
  return res.json(users.map(sanitize));
}

// POST /ad/users
export async function create(req, res) {
  const actor = req.user;
  const startTime = Date.now();
  
  console.log("[adUsers.create] Request received:", {
    actorId: actor?.id || actor?._id || actor?.sub,
    actorRole: actor?.role,
    actorOrgId: actor?.orgId,
    body: {
      email: req.body?.email,
      name: req.body?.name,
      role: req.body?.role,
      mfa: req.body?.mfa,
      orgId: req.body?.orgId,
      sendMethod: req.body?.sendMethod,
      generateOnly: req.body?.generateOnly,
    }
  });
  
  let scopeOrgId = actor?.orgId || null;
  // For superadmins, the organisation must be explicitly provided.  Without an
  // organisation ID, the new student would end up with no org membership.  This
  // change forces the caller to supply orgId for superadmin-created users.
  if (actor?.role === 'superadmin') {
    scopeOrgId = req.body?.orgId || null;
    if (!scopeOrgId) {
      console.warn("[adUsers.create] Missing orgId for superadmin");
      return res.status(400).json({ ok: false, message: "orgId is required for superadmin" });
    }
  }
  if (!scopeOrgId) {
    console.warn("[adUsers.create] No org scope available");
    return res.status(403).json({ ok:false, message:"No org" });
  }

  const { email, name, role: inputRole, mfa, sendMethod, generateOnly } = req.body || {};
  if (!email || !inputRole) {
    console.warn("[adUsers.create] Missing required fields:", { email: !!email, role: !!inputRole });
    return res.status(400).json({ ok:false, message:"email and role required" });
  }
  if (!['teacher','student'].includes(inputRole)) {
    console.warn("[adUsers.create] Invalid role:", inputRole);
    return res.status(400).json({ ok:false, message:"invalid role" });
  }
  
  // Validate sendMethod if provided
  const validSendMethod = sendMethod || 'credentials'; // Default to credentials for backward compatibility
  if (!['credentials', 'invitation'].includes(validSendMethod)) {
    console.warn("[adUsers.create] Invalid sendMethod:", sendMethod);
    return res.status(400).json({ ok:false, message:"sendMethod must be 'credentials' or 'invitation'" });
  }
  
  // If generateOnly is true, it must be invitation method
  if (generateOnly && validSendMethod !== 'invitation') {
    console.warn("[adUsers.create] generateOnly can only be used with invitation method");
    return res.status(400).json({ ok:false, message:"generateOnly can only be used with invitation sendMethod" });
  }

  // Normalize email to lowercase (emails are case-insensitive)
  const normalizedEmail = String(email).toLowerCase().trim();
  if (!normalizedEmail) {
    console.warn("[adUsers.create] Invalid email after normalization:", email);
    return res.status(400).json({ ok: false, message: "Invalid email address" });
  }

  console.log("[adUsers.create] Processing:", {
    originalEmail: email,
    normalizedEmail,
    inputRole,
    scopeOrgId,
  });

  // For "student" inputs, assign the organisation-member role "orguser".
  // This keeps the learner type but records them as an organisation user for access
  // control.  Teachers remain teachers.
  const role = inputRole === 'student' ? 'orguser' : inputRole;

  // Check if user already exists (case-insensitive email check)
  // Use regex for case-insensitive match to catch any existing users with different case
  try {
    const exists = await User.findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    
    if (exists) {
      const roleDisplayName = exists.role === 'orguser' ? 'Student' : exists.role === 'teacher' ? 'Teacher' : exists.role === 'admin' ? 'Admin' : exists.role;
      const statusDisplayName = exists.status === 'active' ? 'Active' : exists.status === 'inactive' ? 'Inactive' : exists.status === 'pending' ? 'Pending' : exists.status;
      
      console.error("[adUsers.create] ❌ User already exists (case-insensitive match):", {
        normalizedEmail,
        existingEmail: exists.email,
        existingUserId: exists._id,
        existingUserRole: exists.role,
        existingUserOrgId: exists.orgId,
        existingUserStatus: exists.status,
        emailMatches: exists.email.toLowerCase() === normalizedEmail,
      });
      
      return res.status(409).json({ 
        ok: false, 
        message: `Unable to create user: An account with email "${exists.email}" already exists in the system.`,
        error: "USER_EXISTS",
        errorCode: "EMAIL_ALREADY_REGISTERED",
        details: {
          requestedEmail: normalizedEmail,
          existingEmail: exists.email,
          existingUserId: String(exists._id),
          existingUserRole: exists.role,
          existingUserRoleDisplay: roleDisplayName,
          existingUserStatus: exists.status,
          existingUserStatusDisplay: statusDisplayName,
          suggestion: `Please use a different email address, or update the existing user (ID: ${String(exists._id)}) if you intended to modify their account.`,
        }
      });
    }
    console.log("[adUsers.create] ✅ Email check passed - user does not exist (case-insensitive)");
  } catch (dbError) {
    console.error("[adUsers.create] Database error checking for existing user:", {
      error: dbError?.message,
      stack: dbError?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    return res.status(500).json({ 
      ok: false, 
      message: "A database error occurred while processing your request. Please try again later or contact support if the issue persists.",
      error: "DB_ERROR",
      errorCode: "DATABASE_ERROR",
      details: {
        suggestion: "This is a temporary issue. Please wait a moment and try again. If the problem continues, contact your system administrator.",
      }
    });
  }

  // --- shared values for both branches ---
  const appBase  = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim() || "http://localhost:5173";
  const signInUrl = `${appBase.replace(/\/$/, "")}/signin`;
  const acceptInvitationUrl = `${appBase.replace(/\/$/, "")}/accept-invitation`;
  let orgName;
  try {
    const org = await Organization.findById(scopeOrgId).select("name").lean();
    orgName = org?.name;
  } catch {}

  // Helper function to create invitation (used by both generate and create)
  async function createInvitation(sendEmail = true) {
    console.log("[adUsers.create] Creating invitation link...", { sendEmail });
    
    // Check if user already exists
    try {
      const exists = await User.findOne({ 
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      
      if (exists) {
        const roleDisplayName = exists.role === 'orguser' ? 'Student' : exists.role === 'teacher' ? 'Teacher' : exists.role === 'admin' ? 'Admin' : exists.role;
        const statusDisplayName = exists.status === 'active' ? 'Active' : exists.status === 'inactive' ? 'Inactive' : exists.status === 'pending' ? 'Pending' : exists.status;
        
        return {
          error: true,
          status: 409,
          data: { 
            ok: false, 
            message: `Unable to create invitation: An account with email "${exists.email}" already exists in the system.`,
            error: "USER_EXISTS",
            errorCode: "EMAIL_ALREADY_REGISTERED",
            details: {
              requestedEmail: normalizedEmail,
              existingEmail: exists.email,
              existingUserId: String(exists._id),
              existingUserRole: exists.role,
              existingUserRoleDisplay: roleDisplayName,
              existingUserStatus: exists.status,
              existingUserStatusDisplay: statusDisplayName,
              suggestion: `Please use a different email address, or update the existing user (ID: ${String(exists._id)}) if you intended to modify their account.`,
            }
          }
        };
      }
    } catch (dbError) {
      console.error("[adUsers.create] Database error checking for existing user:", {
        error: dbError?.message,
        stack: dbError?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      return {
        error: true,
        status: 500,
        data: { 
          ok: false, 
          message: "A database error occurred while processing your request. Please try again later or contact support if the issue persists.",
          error: "DB_ERROR",
          errorCode: "DATABASE_ERROR",
          details: {
            suggestion: "This is a temporary issue. Please wait a moment and try again. If the problem continues, contact your system administrator.",
          }
        }
      };
    }
    
    // Check if there's already a pending invitation for this email (and we want to reuse it)
    let existingInvitation = null;
    let reuseToken = false;
    
    if (!sendEmail) {
      // If we're just generating the link (not sending email), check for existing invitation
      try {
        existingInvitation = await Invitation.findOne({
          email: normalizedEmail,
          accepted: false,
          expiresAt: { $gt: new Date() },
        });
        
        if (existingInvitation && existingInvitation.token) {
          // We have an existing invitation with a stored token - reuse it
          console.log("[adUsers.create] Reusing existing invitation:", existingInvitation._id);
          reuseToken = true;
        } else if (existingInvitation) {
          // Existing invitation but no token stored - invalidate and create new one
          console.log("[adUsers.create] Existing invitation has no token, creating new one");
          existingInvitation.accepted = true;
          await existingInvitation.save();
          existingInvitation = null;
        }
      } catch (invError) {
        console.warn("[adUsers.create] Error checking existing invitations:", invError?.message);
      }
    } else {
      // If we're sending email, check if there's an existing invitation we can send email for
      try {
        existingInvitation = await Invitation.findOne({
          email: normalizedEmail,
          accepted: false,
          expiresAt: { $gt: new Date() },
        });
        
        if (existingInvitation && existingInvitation.token) {
          // We have an existing invitation with a stored token - send email for it
          console.log("[adUsers.create] Found existing invitation, sending email for it:", existingInvitation._id);
          reuseToken = true;
        } else if (existingInvitation) {
          // Existing invitation but no token - invalidate and create new one
          existingInvitation.accepted = true;
          await existingInvitation.save();
          existingInvitation = null;
        }
      } catch (invError) {
        console.warn("[adUsers.create] Error checking existing invitations:", invError?.message);
      }
    }
    
    // Generate invitation token with 24-hour expiration (or reuse existing)
    let token;
    let tokenHash;
    let expiresAt;
    let invitation;
    
    if (reuseToken && existingInvitation) {
      // Reuse existing invitation
      token = existingInvitation.token;
      tokenHash = existingInvitation.tokenHash;
      expiresAt = existingInvitation.expiresAt;
      invitation = existingInvitation;
      
      console.log("[adUsers.create] ✅ Reusing existing invitation:", { 
        invitationId: invitation._id, 
        email: normalizedEmail,
        expiresAt: expiresAt.toISOString(),
      });
    } else {
      // Create new invitation
      token = crypto.randomBytes(32).toString("hex");
      tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const actorId = actor?.sub || actor?._id || actor?.id || null;
      
      try {
        // Create invitation with token stored (for admin flow to send email later)
        invitation = await Invitation.create({
          email: normalizedEmail,
          role: inputRole === 'student' ? 'orguser' : inputRole, // Convert student to orguser
          orgId: scopeOrgId,
          mfaRequired: mfa?.required || false,
          mfaMethod: mfa?.required ? (mfa.method || 'otp') : null,
          managerId: actorId,
          tokenHash,
          token: token, // Store plain token for email sending (admin flow only)
          expiresAt,
          invitedBy: actorId,
          accepted: false,
        });
        
        console.log("[adUsers.create] ✅ Invitation created:", { 
          invitationId: invitation._id, 
          email: normalizedEmail,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (invitationError) {
        console.error("[adUsers.create] ❌ Failed to create invitation:", {
          error: invitationError?.message,
          code: invitationError?.code,
          stack: invitationError?.stack?.split('\n').slice(0, 5).join('\n'),
        });
        return {
          error: true,
          status: 500,
          data: {
            ok: false,
            message: "Failed to create invitation. Please try again later.",
            error: "INVITATION_CREATION_ERROR",
            errorCode: "INVITATION_CREATION_FAILED",
          }
        };
      }
    }
    
    // Generate invitation link
    const invitationLink = `${acceptInvitationUrl}?token=${token}`;
    
    // Send invitation email only if sendEmail is true
    let emailSent = false;
    let emailError = null;
    if (sendEmail) {
      try {
        await sendInvitationEmail(normalizedEmail, invitationLink);
        emailSent = true;
        console.log("[adUsers.create] ✅ Invitation email sent successfully");
      } catch (e) {
        emailError = e;
        const errorMessage = e?.message || String(e);
        const statusCode = e?.response?.statusCode || e?.code || (errorMessage.includes('403') ? 403 : null);
        
        console.error("[adUsers.create] ⚠️ Invitation email failed:");
        console.error("[adUsers.create]   Error:", errorMessage);
        console.error("[adUsers.create]   Status:", statusCode || 'unknown');
        
        // Check for Resend 403 error (test domain restriction)
        const isTestDomainRestriction = 
          statusCode === 403 ||
          errorMessage.includes('only send testing emails to your own email address') ||
          errorMessage.includes('verify a domain') ||
          errorMessage.includes('Test domain can only send to account owner');
        
        if (isTestDomainRestriction) {
          console.error("[adUsers.create] ❌ RESEND 403 ERROR: Test Domain Restriction");
          console.error("[adUsers.create] ⚠️  Invitation created, but email was NOT sent");
          console.error("[adUsers.create] 💡 You can manually share the invitation link");
        }
        
        // Don't fail the request if email fails - invitation is still created
      }
    }
    
    return {
      error: false,
      data: {
        ok: true,
        invitation: {
          id: String(invitation._id),
          email: normalizedEmail,
          role: inputRole,
          expiresAt: expiresAt.toISOString(),
          invitationLink: invitationLink,
          emailSent,
          emailError: emailError ? {
            message: emailError?.message || String(emailError),
            statusCode: emailError?.response?.statusCode || emailError?.code || null,
          } : null,
        },
        message: sendEmail 
          ? (emailSent 
            ? "Invitation created and email sent successfully" 
            : "Invitation created. Email sending failed - you can manually share the invitation link.")
          : "Invitation link generated successfully. You can copy it and send manually, or click Create to send via email.",
      }
    };
  }

  // --- Handle Invitation Link Method ---
  if (validSendMethod === 'invitation') {
    // Check if this is a request to just generate link (generateOnly flag)
    const generateOnly = req.body?.generateOnly === true;
    
    const result = await createInvitation(!generateOnly); // Send email only if not generateOnly
    
    if (result.error) {
      return res.status(result.status).json(result.data);
    }
    
    const duration = Date.now() - startTime;
    console.log("[adUsers.create] ✅ Invitation creation completed in", duration, "ms");
    
    return res.json(result.data);
  }

  // --- Original Credentials Method (Keep Intact) ---
  try {
    if (role === 'teacher') {
      console.log("[adUsers.create] Creating teacher user...");
      const password = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi,'').slice(0,12) + "9!";
      const passwordHash = await bcrypt.hash(password, 10);
      
      let doc;
      try {
        doc = await User.create({
          email: normalizedEmail, // Use normalized email
          name: name || null,
          role: 'teacher', status: 'active',
          orgId: scopeOrgId,
          managerId: actor.sub || actor._id || actor.id || null,
          invitedBy: actor.sub || actor._id || actor.id || null,
          mfa: { required: true, method: (mfa?.method === 'totp' ? 'totp' : 'otp') },
          isVerified: false,
          passwordHash,
        });
        console.log("[adUsers.create] ✅ Teacher user created:", { userId: doc._id, email: normalizedEmail });
      } catch (createError) {
        console.error("[adUsers.create] ❌ Failed to create teacher user:", {
          error: createError?.message,
          code: createError?.code,
          keyPattern: createError?.keyPattern,
          keyValue: createError?.keyValue,
        });
        
        // Check for duplicate key error (MongoDB E11000)
        if (createError?.code === 11000 || createError?.codeName === 'DuplicateKey') {
          // Try to find the existing user to provide better error details
          let existingUser = null;
          try {
            existingUser = await User.findOne({ email: normalizedEmail });
          } catch (lookupError) {
            console.warn("[adUsers.create] Could not lookup existing user:", lookupError?.message);
          }
          
          const roleDisplayName = existingUser?.role === 'orguser' ? 'Student' : existingUser?.role === 'teacher' ? 'Teacher' : existingUser?.role === 'admin' ? 'Admin' : existingUser?.role || 'Unknown';
          const statusDisplayName = existingUser?.status === 'active' ? 'Active' : existingUser?.status === 'inactive' ? 'Inactive' : existingUser?.status === 'pending' ? 'Pending' : existingUser?.status || 'Unknown';
          
          return res.status(409).json({ 
            ok: false, 
            message: `Unable to create teacher: An account with email "${normalizedEmail}" already exists in the system.`,
            error: "USER_EXISTS",
            errorCode: "EMAIL_ALREADY_REGISTERED",
            details: {
              requestedEmail: normalizedEmail,
              existingEmail: existingUser?.email || normalizedEmail,
              existingUserId: existingUser ? String(existingUser._id) : 'Unknown',
              existingUserRole: existingUser?.role || 'Unknown',
              existingUserRoleDisplay: roleDisplayName,
              existingUserStatus: existingUser?.status || 'Unknown',
              existingUserStatusDisplay: statusDisplayName,
              duplicateKey: createError?.keyValue,
              suggestion: existingUser 
                ? `Please use a different email address, or update the existing user (ID: ${String(existingUser._id)}) if you intended to modify their account.`
                : `Please use a different email address. This email is already registered in the system.`,
            }
          });
        }
        throw createError;
      }

      let emailSent = false;
      let emailError = null;
      try {
        await sendStaffCredentialsEmail(normalizedEmail, {
          role: 'teacher', signinUrl: signInUrl, email: normalizedEmail, password,
          mfaMethod: doc.mfa.method, mfaRequired: true,
          orgName, adminName: actor?.name || actor?.email,
        });
        emailSent = true;
        console.log("[adUsers.create] ✅ Teacher credentials email sent successfully");
      } catch (e) {
        emailError = e;
        const errorMessage = e?.message || String(e);
        const statusCode = e?.response?.statusCode || e?.code || (errorMessage.includes('403') ? 403 : null);
        
        console.error("[adUsers.create] ⚠️ Teacher email failed:");
        console.error("[adUsers.create]   Error:", errorMessage);
        console.error("[adUsers.create]   Status:", statusCode || 'unknown');
        
        // Check for Resend 403 error (test domain restriction)
        const isTestDomainRestriction = 
          statusCode === 403 ||
          errorMessage.includes('only send testing emails to your own email address') ||
          errorMessage.includes('verify a domain') ||
          errorMessage.includes('Test domain can only send to account owner');
        
        if (isTestDomainRestriction) {
          console.error("[adUsers.create] ❌ RESEND 403 ERROR: Test Domain Restriction");
          console.error("[adUsers.create] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.error("[adUsers.create] 📌 CAUSE: Using test domain (onboarding@resend.dev)");
          console.error("[adUsers.create] 📌 Test domain can ONLY send to account owner's email");
          console.error("[adUsers.create] 📌 SOLUTION: Verify your domain in Resend");
          console.error("[adUsers.create]     1. Go to: https://resend.com/domains");
          console.error("[adUsers.create]     2. Add your domain");
          console.error("[adUsers.create]     3. Add DNS records (SPF, DKIM, DMARC)");
          console.error("[adUsers.create]     4. Wait for verification");
          console.error("[adUsers.create]     5. Update EMAIL_FROM to use verified domain");
          console.error("[adUsers.create]     6. Restart server");
          console.error("[adUsers.create] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        }
        
        // Check for credit/quota exhaustion (Resend free tier: 3,000/month, 100/day)
        const errorMessages = errorMessage.toLowerCase();
        const isCreditExceeded = 
          errorMessages.includes('quota exceeded') ||
          errorMessages.includes('rate limit') ||
          errorMessages.includes('too many requests') ||
          errorMessages.includes('monthly sending limit') ||
          errorMessages.includes('daily sending limit') ||
          errorMessages.includes('usage limit');
        
        // Log actionable error messages based on error type
        if (isCreditExceeded) {
          console.error("[adUsers.create] 💡 ACTION REQUIRED: Resend free tier quota exceeded");
          console.error("[adUsers.create] 💡 Your Resend account has run out of email credits");
          console.error("[adUsers.create] 💡 Free tier limits:");
          console.error("[adUsers.create]     • Daily: 100 emails/day (resets every 24 hours)");
          console.error("[adUsers.create]     • Monthly: 3,000 emails/month (resets on 1st)");
          console.error("[adUsers.create] 💡 Check which limit was hit:");
          console.error("[adUsers.create]     → Go to: https://resend.com/emails");
          console.error("[adUsers.create] 💡 If DAILY limit: Wait ~24 hours for reset");
          console.error("[adUsers.create] 💡 If MONTHLY limit: Wait for 1st of month or upgrade");
          console.error("[adUsers.create] 💡 User was created successfully, but email was not sent");
        } else if (statusCode === 401) {
          console.error("[adUsers.create] 💡 ACTION REQUIRED: Invalid Resend API key");
          console.error("[adUsers.create] 💡 Check your RESEND_API_KEY in .env file");
        } else if (statusCode === 403) {
          console.error("[adUsers.create] 💡 ACTION REQUIRED: Resend permission issue");
          console.error("[adUsers.create] 💡 Verify your domain and FROM email address in Resend dashboard");
        } else if (statusCode === 400) {
          console.error("[adUsers.create] 💡 ACTION REQUIRED: Invalid email configuration");
          console.error("[adUsers.create] 💡 Check your EMAIL_FROM environment variable and domain verification");
        }
        
        // Don't fail the request if email fails - user is still created
      }
      
      const duration = Date.now() - startTime;
      console.log("[adUsers.create] ✅ Teacher creation completed in", duration, "ms");
      return res.json({ ...sanitize(doc), emailSent });
    }

    // organisation member (learner)
    console.log("[adUsers.create] Creating student/orguser...");
    const password = crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi,'').slice(0,12) + "9!";
    const passwordHash = await bcrypt.hash(password, 10);
    
    let doc;
    try {
      doc = await User.create({
        email: normalizedEmail, // Use normalized email
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
      console.log("[adUsers.create] ✅ Student user created:", { userId: doc._id, email: normalizedEmail, role: doc.role });
    } catch (createError) {
      console.error("[adUsers.create] ❌ Failed to create student user:", {
        error: createError?.message,
        code: createError?.code,
        codeName: createError?.codeName,
        keyPattern: createError?.keyPattern,
        keyValue: createError?.keyValue,
        stack: createError?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      
      // Check for duplicate key error (MongoDB E11000)
      if (createError?.code === 11000 || createError?.codeName === 'DuplicateKey') {
        // Try to find the existing user to provide better error details
        let existingUser = null;
        try {
          existingUser = await User.findOne({ email: normalizedEmail });
        } catch (lookupError) {
          console.warn("[adUsers.create] Could not lookup existing user:", lookupError?.message);
        }
        
        const roleDisplayName = existingUser?.role === 'orguser' ? 'Student' : existingUser?.role === 'teacher' ? 'Teacher' : existingUser?.role === 'admin' ? 'Admin' : existingUser?.role || 'Unknown';
        const statusDisplayName = existingUser?.status === 'active' ? 'Active' : existingUser?.status === 'inactive' ? 'Inactive' : existingUser?.status === 'pending' ? 'Pending' : existingUser?.status || 'Unknown';
        
        return res.status(409).json({ 
          ok: false, 
          message: `Unable to create student: An account with email "${normalizedEmail}" already exists in the system.`,
          error: "USER_EXISTS",
          errorCode: "EMAIL_ALREADY_REGISTERED",
          details: {
            requestedEmail: normalizedEmail,
            existingEmail: existingUser?.email || normalizedEmail,
            existingUserId: existingUser ? String(existingUser._id) : 'Unknown',
            existingUserRole: existingUser?.role || 'Unknown',
            existingUserRoleDisplay: roleDisplayName,
            existingUserStatus: existingUser?.status || 'Unknown',
            existingUserStatusDisplay: statusDisplayName,
            duplicateKey: createError?.keyValue,
            suggestion: existingUser 
              ? `Please use a different email address, or update the existing user (ID: ${String(existingUser._id)}) if you intended to modify their account.`
              : `Please use a different email address. This email is already registered in the system.`,
          }
        });
      }
      throw createError;
    }

    let emailSent = false;
    let emailError = null;
    try {
      await sendStaffCredentialsEmail(normalizedEmail, {
        // We still mention 'student' in the email to the recipient, but the actual
        // stored role is doc.role.  The public-facing term can remain 'student'
        // while the backend uses 'orguser' for access control.
        role: inputRole,
        signinUrl: signInUrl,
        email: normalizedEmail,
        password,
        mfaMethod: doc.mfa.method,
        mfaRequired: !!doc.mfa.required,
        orgName,
        adminName: actor?.name || actor?.email,
      });
      emailSent = true;
      console.log("[adUsers.create] ✅ Student credentials email sent successfully");
    } catch (e) {
      emailError = e;
      const statusCode = e?.response?.statusCode || e?.code;
      const errorBody = e?.response?.body;
      
      console.error("[adUsers.create] ⚠️ Student email failed:");
      console.error("[adUsers.create]   Error:", e?.message);
      console.error("[adUsers.create]   Status:", statusCode || 'unknown');
      
      if (errorBody) {
        console.error("[adUsers.create]   Resend Error Details:", typeof errorBody === 'object' ? JSON.stringify(errorBody, null, 2) : errorBody);
      }
      
      // Check for credit/quota exhaustion (Resend free tier: 3,000/month, 100/day)
      const errorMessages = (typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody || {})).toLowerCase();
      const isCreditExceeded = 
        errorMessages.includes('quota exceeded') ||
        errorMessages.includes('rate limit') ||
        errorMessages.includes('too many requests') ||
        errorMessages.includes('monthly sending limit') ||
        errorMessages.includes('daily sending limit') ||
        errorMessages.includes('usage limit');
      
      // Log actionable error messages based on error type
      if (isCreditExceeded) {
        console.error("[adUsers.create] 💡 ACTION REQUIRED: Resend free tier quota exceeded");
        console.error("[adUsers.create] 💡 Your Resend account has run out of email credits");
        console.error("[adUsers.create] 💡 Free tier limits:");
        console.error("[adUsers.create]     • Daily: 100 emails/day (resets every 24 hours)");
        console.error("[adUsers.create]     • Monthly: 3,000 emails/month (resets on 1st)");
        console.error("[adUsers.create] 💡 Check which limit was hit:");
        console.error("[adUsers.create]     → Go to: https://resend.com/emails");
        console.error("[adUsers.create] 💡 If DAILY limit: Wait ~24 hours for reset");
        console.error("[adUsers.create] 💡 If MONTHLY limit: Wait for 1st of month or upgrade");
        console.error("[adUsers.create] 💡 User was created successfully, but email was not sent");
      } else if (statusCode === 401) {
        console.error("[adUsers.create] 💡 ACTION REQUIRED: Invalid Resend API key");
        console.error("[adUsers.create] 💡 Check your RESEND_API_KEY in .env file");
      } else if (statusCode === 403) {
        // Check if it's the test domain restriction error
        const errorMessage = e?.message || String(e);
        const isTestDomainRestriction = 
          errorMessage.includes('only send testing emails to your own email address') ||
          errorMessage.includes('verify a domain') ||
          errorMessage.includes('Test domain can only send to account owner');
        
        if (isTestDomainRestriction) {
          console.error("[adUsers.create] ❌ RESEND 403 ERROR: Test Domain Restriction");
          console.error("[adUsers.create] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.error("[adUsers.create] 📌 CAUSE: Using test domain (onboarding@resend.dev)");
          console.error("[adUsers.create] 📌 Test domain can ONLY send to account owner's email");
          console.error("[adUsers.create] 📌 SOLUTION: Verify your domain in Resend");
          console.error("[adUsers.create]     1. Go to: https://resend.com/domains");
          console.error("[adUsers.create]     2. Add your domain");
          console.error("[adUsers.create]     3. Add DNS records (SPF, DKIM, DMARC)");
          console.error("[adUsers.create]     4. Wait for verification");
          console.error("[adUsers.create]     5. Update EMAIL_FROM to use verified domain");
          console.error("[adUsers.create]     6. Restart server");
          console.error("[adUsers.create] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.error("[adUsers.create] ⚠️  User was created successfully, but email was NOT sent");
          console.error("[adUsers.create] ⚠️  User will need to use 'Forgot Password' to set their password");
        } else {
          console.error("[adUsers.create] 💡 ACTION REQUIRED: Resend permission issue");
          console.error("[adUsers.create] 💡 Verify your domain and FROM email address in Resend dashboard");
        }
      } else if (statusCode === 400) {
        console.error("[adUsers.create] 💡 ACTION REQUIRED: Invalid email configuration");
        console.error("[adUsers.create] 💡 Check your EMAIL_FROM environment variable and domain verification");
      }
      
      // Don't fail the request if email fails - user is still created
      // The user can manually send credentials or fix email configuration
    }
    
    const duration = Date.now() - startTime;
    console.log("[adUsers.create] ✅ Student creation completed in", duration, "ms");
    return res.json({ ...sanitize(doc), emailSent });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[adUsers.create] ❌ Unexpected error after", duration, "ms:", {
      error: error?.message,
      code: error?.code,
      codeName: error?.codeName,
      stack: error?.stack?.split('\n').slice(0, 10).join('\n'),
    });
    return res.status(500).json({ 
      ok: false, 
      message: error?.message || "Internal server error",
      error: "INTERNAL_ERROR"
    });
  }
}

// PATCH /ad/users/:id
export async function patch(req, res) {
    const actor = req.user;
    const { id } = req.params;
    if (!actor?.orgId) return res.status(403).json({ ok: false });

    const u = await User.findOne({ _id: id, orgId: actor.orgId, role: { $in: ['teacher', 'orguser'] } });
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
        { _id: id, orgId: actor.orgId, role: { $in: ['teacher', 'orguser'] } },
        { $set: { status } },
        { new: true }
    );
    if (!u) return res.status(404).json({ ok: false });
    return res.json(sanitize(u));
}

// (Optional) POST /ad/users/:id/role — only teacher<->student switches
export async function setRole(req, res) {
    const actor = req.user;
    const { id } = req.params;
    const { role: inputRole } = req.body || {};
    if (!['teacher', 'student'].includes(inputRole)) return res.status(400).json({ ok: false });

    // Map 'student' to 'orguser'
    const finalRole = inputRole === 'student' ? 'orguser' : inputRole;

    const u = await User.findOneAndUpdate(
        { _id: id, orgId: actor.orgId, role: { $in: ['teacher', 'orguser'] } },
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

    const u = await User.findOne({ _id: id, orgId: actor.orgId, role: { $in: ['teacher', 'orguser'] } });
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
    if (r === 'teacher') return 'teacher';
    if (r === 'student') return 'student';
    return 'student';
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
    // store as 'orguser' for students; teachers stay 'teacher'
    const finalRole = roleIn === 'student' ? 'orguser' : 'teacher';
    const name = raw.name || undefined;
    const status = normStatus(raw.status) || (finalRole === 'orguser' ? 'active' : undefined);

    // MFA
    const mfaRequired = ('mfaRequired' in raw) ? truthy(raw.mfaRequired) :
                        ('mfa' in raw && typeof raw.mfa === 'object' && 'required' in raw.mfa) ? !!raw.mfa.required :
                        true; // default ON for both teacher and learners in admin portal
    const mfaMethod = normMethod(raw.mfaMethod || raw?.mfa?.method) || (mfaRequired ? (finalRole === 'teacher' ? 'totp' : 'otp') : null);

    // Manager: explicit managerRef → that admin; else fallback to current actor; else first active admin
    let managerDoc = resolveManager(raw.managerRef) || null;
    if (!managerDoc && actor?.role === 'admin' && String(actor.orgId) === String(scopeOrgId)) {
      managerDoc = { _id: actor.sub || actor._id || actor.id, email: actor.email, orgId: scopeOrgId };
    }
    if (!managerDoc) managerDoc = fallbackAdmin;
    if (!managerDoc) {
  managerDoc = actor;   // fallback to importer
}

    const existing = await User.findOne({ email });

    // --- CREATE ---
    if (!existing) {
      const plain = (finalRole === 'teacher' && raw.password && String(raw.password).length >= 8)
        ? String(raw.password)
        : (crypto.randomBytes(10).toString("base64").replace(/[^a-z0-9]/gi,'').slice(0,12) + "9!");
      const passwordHash = await bcrypt.hash(plain, 12);

      const doc = await User.create({
        email,
        name: name || null,
        role: finalRole,
        status: status || 'active',
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
          role: roleIn, // public-facing: 'student' or 'teacher'
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
    if (!['teacher','orguser'].includes(existing.role)) { skipped.push({ email, reason:'role_not_allowed' }); continue; }

    let changed = false;
    if (name !== undefined && existing.name !== name) { existing.name = name; changed = true; }
    if (status !== undefined && existing.status !== status) { existing.status = status; changed = true; }

    // Allow teacher<->student flips via CSV
    if (existing.role !== finalRole) { existing.role = finalRole; changed = true; }

    // Update manager if resolvable
    if (managerDoc && String(existing.managerId || '') !== String(managerDoc._id)) {
      existing.managerId = managerDoc._id; changed = true;
    }

    // Password (only honored for teacher; ignored for learners)
    if (finalRole === 'teacher' && raw.password && String(raw.password).length >= 8) {
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