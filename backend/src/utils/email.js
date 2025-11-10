// backend/src/utils/email.js
import nodemailer from "nodemailer";
import crypto from "crypto";

/** Resolve public app URL (first entry in PUBLIC_APP_URL) */
function getPublicUrl() {
  const raw = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim();
  try { return new URL(raw); } catch { return null; }
}
const APP_URL = getPublicUrl()?.toString().replace(/\/$/, "") || "";
const APP_HOST = getPublicUrl()?.hostname || "localhost";

/** Derive brand name from MAIL_FROM or fallback */
function getBrandName() {
  const from = process.env.MAIL_FROM || "";
  const m = /^"?([^"<]+)"?\s*</.exec(from);
  return (m?.[1] || process.env.MAIL_FROM_NAME || "ECA").trim();
}
const BRAND = getBrandName();

/** Create nodemailer transporter with production-optimized settings */
function createMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure:
      String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
      Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Extended timeout settings for production environments (like Render)
    // Increased timeouts to handle slow network connections
    connectionTimeout: 90000, // 90 seconds (increased from 60)
    greetingTimeout: 60000,   // 60 seconds (increased from 30)
    socketTimeout: 90000,     // 90 seconds (increased from 60)
    // Disable connection pooling to avoid stale connections
    // Each email will use a fresh connection, which is more reliable in production
    pool: false,
    // Better error handling - don't log in production to avoid noise
    logger: false,
    debug: false,
    // TLS options for better compatibility
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates (useful for some SMTP servers)
      minVersion: 'TLSv1.2',
    },
    // Additional options for production reliability
    // requireTLS will be automatically handled based on secure flag and port
    // Don't wait for connection to close
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

/** Nodemailer transporter (recreated on errors for resilience) */
let mailer = createMailer();

/** Recreate transporter if connection fails (helps recover from timeouts) */
function recreateMailer() {
  try {
    // Close existing transporter if it exists
    if (mailer && typeof mailer.close === 'function') {
      mailer.close().catch(() => {}); // Ignore errors when closing
    }
  } catch (e) {
    // Ignore errors
  }
  mailer = createMailer();
}

/** Shared headers for better deliverability and threading */
function baseHeaders() {
  return {
    "X-Entity-Ref-ID": crypto.randomUUID(),
    "List-Unsubscribe": `<mailto:unsubscribe@${APP_HOST}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Wraps content in a professional template */
function renderTemplate({ title, preheader, contentHtml }) {
  const brand = BRAND;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    /* Basic, mobile-first email-safe styles */
    body { margin:0; padding:0; background:#f6f7fb; color:#0f172a; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 560px; margin: 32px auto; padding: 0 12px; }
    .card { background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; }
    .header { padding:16px 20px; border-bottom:1px solid #e2e8f0; }
    .brand { font-size:16px; font-weight:700; color:#111827; }
    .title { font-size:18px; font-weight:700; margin:0 0 8px; color:#111827; }
    .content { padding:16px 20px; font-size:14px; line-height:1.6; color:#0f172a; }
    .btn { display:inline-block; padding:12px 18px; background:#4f46e5; color:#fff !important; text-decoration:none; border-radius:10px; font-weight:600; }
    .code { font-size:28px; letter-spacing:2px; font-weight:800; color:#111827; }
    .muted { color:#64748b; font-size:12px; }
    .footer { text-align:center; color:#475569; font-size:12px; margin-top:10px; }
    a { color:#334155; }
    @media (prefers-color-scheme: dark) {
      body { background:#0b1220; color:#e6e6e6; }
      .card { background:#0f172a; border-color:#202c40; }
      .header { border-bottom-color:#202c40; }
      .brand, .title, .content { color:#e6e6e6; }
      .muted, .footer { color:#9aa7b3; }
    }
  </style>
</head>
<body>
  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
    ${escapeHtml(preheader || "")}
  </div>

  <div class="container">
    <div class="card">
      <div class="header">
        <div class="brand">${escapeHtml(brand)}</div>
      </div>
      <div class="content">
        <h1 class="title">${escapeHtml(title)}</h1>
        ${contentHtml}
      </div>
    </div>
    <div class="footer">
      Sent by ${escapeHtml(brand)}${APP_URL ? ` • <a href="${APP_URL}">${escapeHtml(APP_HOST)}</a>` : ""}
    </div>
  </div>
</body>
</html>`;
}

/** Safe HTML escaping for text nodes */
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/** Send email with retry logic for production reliability */
async function sendEmailWithRetry(mailOptions, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await mailer.sendMail(mailOptions);
      return; // Success
    } catch (error) {
      lastError = error;
      const errorMsg = (error?.message || String(error)).toLowerCase();
      const errorCode = error?.code || "";
      
      // Detect timeout and connection-related errors that should be retried
      const isRetryableError = 
        errorMsg.includes("timeout") || 
        errorMsg.includes("etimedout") || 
        errorMsg.includes("connection timeout") ||
        errorMsg.includes("econnreset") ||
        errorMsg.includes("econnrefused") ||
        errorMsg.includes("enotfound") ||
        errorMsg.includes("socket hang up") ||
        errorCode === "ETIMEDOUT" ||
        errorCode === "ECONNRESET" ||
        errorCode === "ECONNREFUSED" ||
        errorCode === "ENOTFOUND";
      
      if (isRetryableError && attempt < maxRetries) {
        // Recreate transporter on connection error to get fresh connection
        console.warn(`[smtp] Connection error on attempt ${attempt + 1}/${maxRetries + 1}: ${errorMsg.substring(0, 100)}`);
        console.warn(`[smtp] Recreating transporter and retrying...`);
        recreateMailer();
        // Wait before retry (exponential backoff: 1s, 2s, 3s)
        const delayMs = 1000 * (attempt + 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // If not a retryable error or out of retries, throw immediately
      // (e.g., authentication errors, invalid recipient, etc.)
      throw error;
    }
  }
  throw lastError;
}

/** ========== Public API ========== */

export async function sendOtpEmail(to, code) {
  const subject = `Your ${BRAND} verification code`;
  const preheader = "Use this code to continue. Expires in 10 minutes.";

  const contentHtml = `
    <p>Hello,</p>
    <p>Your verification code is:</p>
    <p class="code">${escapeHtml(code)}</p>
    <p class="muted">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  `;
  const html = renderTemplate({ title: "Verify your sign-in", preheader, contentHtml });

  const text = `Hello,

Your verification code is: ${code}

This code expires in 10 minutes. If you didn't request it, you can ignore this email.`;

  const messageId = `<otp-${Date.now()}-${Math.random().toString(36).slice(2)}@${APP_HOST}>`;

  await sendEmailWithRetry({
    from: process.env.MAIL_FROM || "ECA <no-reply@example.com>",
    to,
    subject,
    text,
    html,
    headers: baseHeaders(),
    messageId,
  });
}

export async function sendInvitationEmail(to, link) {
  const subject = `You’re invited to ${BRAND}`;
  const preheader = "Accept your invitation and set up your account.";

  const safeLink = String(link || "");
  const contentHtml = `
    <p>Hello,</p>
    <p>You’ve been invited to join <b>${escapeHtml(BRAND)}</b>. Click the button below to set up your account.</p>
    <p style="margin:18px 0"><a class="btn" href="${safeLink}">Accept invitation</a></p>
    <p class="muted">If the button doesn’t work, copy and paste this URL into your browser:</p>
    <p class="muted" style="word-break:break-all;">${escapeHtml(safeLink)}</p>
    <p class="muted">If you didn’t expect this, you can ignore this email.</p>
  `;
  const html = renderTemplate({ title: "You’re invited", preheader, contentHtml });

  const text = `Hello,

You’ve been invited to join ${BRAND}.

Open this link to set up your account:
${safeLink}

If you didn’t expect this, you can ignore this email.`;

  const messageId = `<invite-${Date.now()}-${Math.random().toString(36).slice(2)}@${APP_HOST}>`;

  await sendEmailWithRetry({
    from: process.env.MAIL_FROM || "ECA <no-reply@example.com>",
    to,
    subject,
    text,
    html,
    headers: baseHeaders(),
    messageId,
  });
}

export async function sendPasswordResetEmail(to, resetLink) {
  const subject = `Reset your ${BRAND} password`;
  const preheader = "Click the link below to reset your password. Expires in 1 hour.";

  const safeLink = String(resetLink || "");
  const contentHtml = `
    <p>Hello,</p>
    <p>You requested to reset your password for your <b>${escapeHtml(BRAND)}</b> account.</p>
    <p style="margin:18px 0"><a class="btn" href="${safeLink}">Reset Password</a></p>
    <p class="muted">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p class="muted" style="word-break:break-all;">${escapeHtml(safeLink)}</p>
    <p class="muted">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
  `;
  const html = renderTemplate({ title: "Reset your password", preheader, contentHtml });

  const text = `Hello,

You requested to reset your password for your ${BRAND} account.

Click this link to reset your password:
${safeLink}

This link expires in 1 hour. If you didn't request this, you can ignore this email.`;

  const messageId = `<reset-${Date.now()}-${Math.random().toString(36).slice(2)}@${APP_HOST}>`;

  await sendEmailWithRetry({
    from: process.env.MAIL_FROM || "ECA <no-reply@example.com>",
    to,
    subject,
    text,
    html,
    headers: baseHeaders(),
    messageId,
  });
}

export async function verifyMailer() {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("[smtp] SMTP not configured - emails will not be sent");
      console.warn("[smtp] Required environment variables:");
      console.warn("[smtp]   SMTP_HOST (e.g., smtp.gmail.com)");
      console.warn("[smtp]   SMTP_PORT (e.g., 587)");
      console.warn("[smtp]   SMTP_USER (your email)");
      console.warn("[smtp]   SMTP_PASS (your app password)");
      console.warn("[smtp]   MAIL_FROM (e.g., 'ECA Academy <noreply@yourapp.com>')");
      return false;
    }
    
    // Don't verify on startup in production - it can cause timeouts and block the server
    // Instead, we'll verify on first email send (lazy verification)
    if (process.env.NODE_ENV === 'production') {
      console.log("[smtp] SMTP configured (verification skipped in production - will verify on first send)");
      return true;
    }
    
    // In development, verify with a shorter timeout
    const verifyPromise = mailer.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("SMTP verification timeout")), 15000)
    );
    
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log("[smtp] transporter is ready");
    return true;
  } catch (e) {
    const errorMsg = e?.message || String(e);
    console.warn("[smtp] verify failed (non-blocking):", errorMsg);
    // Don't throw - allow server to start even if verification fails
    // Emails will be attempted and errors handled at send time
    return false;
  }
}

// ADD this to backend/src/utils/email.js (below existing exports)
export async function sendStaffCredentialsEmail(
  to,
  {
    role,                 // 'admin' | 'vendor' | 'student'
    signinUrl,            // absolute URL to /signin
    email,                // account email
    password,             // generated or chosen password
    mfaMethod,            // 'otp' | 'totp' | null
    mfaRequired,          // optional: boolean (if omitted for students, inferred from mfaMethod)
    orgName,              // optional: pretty org name
    orgId,                // optional: fallback id if name missing
    adminName,            // optional: for vendor/student, show supervising admin
    managerName,          // alias for adminName (either works)
  }
) {
  const roleLabel =
    role === 'admin' ? 'Admin' :
    role === 'vendor' ? 'Vendor' :
    role === 'student' ? 'Student' : 'Account';

  // MFA rules:
  // - Admin/Vendor: always required
  // - Student: required if mfaRequired===true; if not provided, infer from mfaMethod
  const _mfaRequired = (role === 'admin' || role === 'vendor')
    ? true
    : (typeof mfaRequired === 'boolean' ? mfaRequired : !!mfaMethod);

  const _mfaMethod = _mfaRequired ? (mfaMethod || 'otp') : null;
  const orgDisplay = orgName || orgId || '';

  const adminDisplay = adminName || managerName || '';
  const subject = `Your ${BRAND} ${roleLabel} account is ready`;
  const preheader = (() => {
    if (role === 'admin' || role === 'vendor') {
      return "Sign in with the credentials below and complete MFA to activate your account.";
    }
    return _mfaRequired
      ? "Sign in with the credentials below. MFA is required on first login."
      : "Sign in with the credentials below. No MFA is required.";
  })();

  const safeLink = String(signinUrl || "");
  const mfaLineHtml = _mfaRequired
    ? `<p style="margin:0"><b>MFA:</b> ${escapeHtml(String(_mfaMethod).toUpperCase())} is required</p>`
    : `<p style="margin:0"><b>MFA:</b> Not required</p>`;

  const adminLineHtml = adminDisplay
    ? `<p style="margin:0 0 6px"><b>Admin:</b> ${escapeHtml(adminDisplay)}</p>`
    : '';

  const contentHtml = `
    <p>Hello,</p>
    <p>Your ${escapeHtml(roleLabel)} account has been created in <b>${escapeHtml(BRAND)}</b>.</p>

    <div style="margin:14px 0;padding:12px;border:1px solid #e2e8f0;border-radius:10px">
      <p style="margin:0 0 6px"><b>Sign-in Email:</b> ${escapeHtml(email)}</p>
      <p style="margin:0 0 6px"><b>Password:</b> ${escapeHtml(password)}</p>
      ${orgDisplay ? `<p style="margin:0 0 6px"><b>Organization:</b> ${escapeHtml(orgDisplay)}</p>` : ""}
      ${adminLineHtml}
      ${mfaLineHtml}
    </div>

    <p style="margin:18px 0"><a class="btn" href="${safeLink}">Sign in</a></p>
    <p class="muted">${_mfaRequired ? "You must complete the MFA challenge on first sign-in to activate your account." : "You can sign in immediately using the credentials above."}</p>
    <p class="muted">If the button doesn’t work, copy and paste this URL into your browser:</p>
    <p class="muted" style="word-break:break-all;">${escapeHtml(safeLink)}</p>
  `;

  const html = renderTemplate({ title: "Your account is ready", preheader, contentHtml });

  const text = [
    `Your ${roleLabel} account is ready.`,
    '',
    `Email: ${email}`,
    `Password: ${password}`,
    ...(orgDisplay ? [`Organization: ${orgDisplay}`] : []),
    ...(adminDisplay ? [`Admin: ${adminDisplay}`] : []),
    _mfaRequired ? `MFA: ${(String(_mfaMethod).toUpperCase())} (required)` : 'MFA: Not required',
    '',
    'Sign in:',
    safeLink,
    '',
    _mfaRequired
      ? 'You must complete the MFA challenge on first sign-in to activate your account.'
      : 'You can sign in immediately using the credentials above.',
  ].join('\n');

  const messageId = `<staff-${Date.now()}-${Math.random().toString(36).slice(2)}@${APP_HOST}>`;
  await sendEmailWithRetry({
    from: process.env.MAIL_FROM || "ECA <no-reply@example.com>",
    to,
    subject,
    text,
    html,
    headers: baseHeaders(),
    messageId,
  });
}