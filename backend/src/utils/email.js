// backend/src/utils/email.js
import { Resend } from "resend";
import crypto from "crypto";

/** Resolve public app URL (first entry in PUBLIC_APP_URL) */
function getPublicUrl() {
  const raw = (process.env.PUBLIC_APP_URL || "").split(",")[0]?.trim();
  try { return new URL(raw); } catch { return null; }
}
const APP_URL = getPublicUrl()?.toString().replace(/\/$/, "") || "";
const APP_HOST = getPublicUrl()?.hostname || "localhost";

/** Derive brand name from EMAIL_FROM or MAIL_FROM or fallback */
function getBrandName() {
  const from = process.env.EMAIL_FROM || process.env.MAIL_FROM || "";
  
  // Try to extract name from "Name <email@example.com>" format
  const m = /^"?([^"<]+)"?\s*</.exec(from);
  if (m && m[1]) {
    return m[1].trim();
  }
  
  // If no name in EMAIL_FROM, try MAIL_FROM_NAME
  if (process.env.MAIL_FROM_NAME) {
    return process.env.MAIL_FROM_NAME.trim();
  }
  
  // Fallback to "ECA"
  return "ECA";
}
const BRAND = getBrandName();

/** Initialize Resend with API key */
function initializeResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[resend] RESEND_API_KEY not configured - emails will not be sent");
    console.warn("[resend] Get your API key from: https://resend.com/api-keys");
    return null;
  }
  
  // Validate API key format (Resend API keys start with "re_")
  if (!apiKey.startsWith("re_")) {
    console.warn("[resend] ⚠️  WARNING: API key format looks incorrect!");
    console.warn("[resend] Resend API keys should start with 're_'");
    console.warn("[resend] Get your API key from: https://resend.com/api-keys");
    // Still try to use it, but warn the user
  }
  
  try {
    const resend = new Resend(apiKey);
    return resend;
  } catch (error) {
    console.error("[resend] Failed to initialize Resend:", error?.message);
    return null;
  }
}

// Initialize Resend on module load
const resendClient = initializeResend();
const resendInitialized = !!resendClient;

/** Extract email address from "Name <email@example.com>" format or return as-is */
function extractEmailAddress(fromString) {
  if (!fromString) return null;
  
  // Try to extract email from "Name <email@example.com>" format
  const emailMatch = fromString.match(/<([^>]+)>/);
  if (emailMatch && emailMatch[1]) {
    return emailMatch[1].trim();
  }
  
  // If no angle brackets, assume it's just an email address
  if (!fromString.includes('<') && !fromString.includes('>')) {
    return fromString.trim();
  }
  
  return fromString.trim();
}

/** Get the "from" email address from environment variables
 * Resend accepts: "Name <email@example.com>" or "email@example.com"
 * Note: The domain must be verified in Resend dashboard
 */
function getFromEmail() {
  // Prefer EMAIL_FROM, fallback to MAIL_FROM
  const from = process.env.EMAIL_FROM || process.env.MAIL_FROM || "ECA <onboarding@resend.dev>";
  
  // If it's just an email (no name), ensure it's valid
  // Resend will accept it as-is
  if (from && !from.includes('<') && !from.includes('>')) {
    // Just an email address, that's fine for Resend
    return from;
  }
  
  // Has name and email format, return as-is
  return from;
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

/** Send email using Resend API with retry logic */
async function sendEmailWithRetry(mailOptions, maxRetries = 2) {
  if (!resendInitialized || !resendClient) {
    throw new Error("Resend not initialized - RESEND_API_KEY is missing");
  }

  let lastError;
  const startTime = Date.now();
  
  // Convert mailOptions to Resend format
  const fromEmail = mailOptions.from || getFromEmail();
  const toEmail = mailOptions.to;
  const subject = mailOptions.subject;
  const text = mailOptions.text;
  const html = mailOptions.html;
  const headers = mailOptions.headers || {};
  
  // Resend message data
  // Resend accepts 'to' as string or array, and headers are optional
  const messageData = {
    from: fromEmail,
    to: toEmail, // Can be string or array
    subject: subject,
    html: html,
    text: text,
  };
  
  // Add headers if provided (Resend supports custom headers)
  if (headers && Object.keys(headers).length > 0) {
    messageData.headers = headers;
  }
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Send email via Resend
      const response = await resendClient.emails.send(messageData);
      
      // IMPORTANT: Check for errors in response FIRST
      // Resend API returns { data: {...}, error: null } on success
      // Or { data: null, error: {...} } on failure
      // The API doesn't throw exceptions, it returns errors in the response object
      if (response?.error) {
        const error = response.error;
        const statusCode = error.statusCode || error.code || 400;
        const errorMessage = error.message || String(error);
        const errorName = error.name || 'ResendError';
        
        // Check for specific error: test domain restriction (403)
        if (statusCode === 403 && (
          errorMessage.includes('only send testing emails to your own email address') ||
          errorMessage.includes('verify a domain') ||
          errorMessage.includes('testing emails')
        )) {
          const duration = Date.now() - startTime;
          console.error(`[resend] ❌❌❌ EMAIL SENDING FAILED (403 Forbidden) ❌❌❌`);
          console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.error(`[resend] 📌 ROOT CAUSE: Test Domain Restriction`);
          console.error(`[resend] 📌 From Address: ${fromEmail}`);
          console.error(`[resend] 📌 To Address: ${toEmail}`);
          console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.error(`[resend] ⚠️  RESEND RESTRICTION:`);
          console.error(`[resend]     The test domain (onboarding@resend.dev) can ONLY send emails`);
          console.error(`[resend]     to the email address associated with your Resend account.`);
          console.error(`[resend]     Your Resend account email: mithunkumarkulal33@gmail.com`);
          console.error(`[resend]     You tried to send to: ${toEmail}`);
          console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.error(`[resend] ✅ SOLUTION: Verify Your Domain (REQUIRED FOR PRODUCTION)`);
          console.error(`[resend]     Step 1: Go to https://resend.com/domains`);
          console.error(`[resend]     Step 2: Click "Add Domain"`);
          console.error(`[resend]     Step 3: Enter your domain (e.g., yourdomain.com)`);
          console.error(`[resend]     Step 4: Add DNS records in your domain provider:`);
          console.error(`[resend]        • SPF record (TXT)`);
          console.error(`[resend]        • DKIM records (CNAME - usually 2-3 records)`);
          console.error(`[resend]        • DMARC record (TXT - optional but recommended)`);
          console.error(`[resend]     Step 5: Wait for verification (5-30 minutes)`);
          console.error(`[resend]     Step 6: Update .env file:`);
          console.error(`[resend]        EMAIL_FROM=noreply@yourdomain.com`);
          console.error(`[resend]     Step 7: Restart your server`);
          console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.error(`[resend] ⏱️  Attempt ${attempt + 1}/${maxRetries + 1} failed after ${duration}ms`);
          console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          // Don't retry for 403 errors - they won't succeed without domain verification
          throw new Error(`Resend API Error (403): Test domain can only send to account owner's email. Please verify your domain to send to other recipients.`);
        }
        
        // Other Resend API errors
        const duration = Date.now() - startTime;
        console.error(`[resend] ❌ EMAIL SENDING FAILED`);
        console.error(`[resend] Status Code: ${statusCode}`);
        console.error(`[resend] Error Type: ${errorName}`);
        console.error(`[resend] Error Message: ${errorMessage}`);
        console.error(`[resend] Attempt: ${attempt + 1}/${maxRetries + 1} (${duration}ms)`);
        console.error(`[resend] Full error:`, JSON.stringify(error, null, 2));
        
        throw new Error(`Resend API Error (${statusCode}): ${errorMessage}`);
      }
      
      // Success: Check for data in response
      if (!response?.data) {
        const duration = Date.now() - startTime;
        console.warn(`[resend] ⚠️  Warning: Response received but no data field`);
        console.warn(`[resend] Full response:`, JSON.stringify(response, null, 2));
        console.warn(`[resend] This might indicate an issue - check Resend dashboard`);
        // Still continue as it might be a success case we don't recognize
      }
      
      // Resend returns { data: { id: '...' } } on success
      const emailId = response?.data?.id || null;
      const duration = Date.now() - startTime;
      
      console.log(`[resend] ✅ Email sent successfully in ${duration}ms`);
      console.log(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[resend] 📧 Email Details:`);
      console.log(`[resend]   Email ID: ${emailId || 'N/A (check Resend dashboard)'}`);
      console.log(`[resend]   To: ${toEmail}`);
      console.log(`[resend]   From: ${fromEmail}`);
      console.log(`[resend]   Subject: ${subject}`);
      console.log(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      if (emailId) {
        console.log(`[resend] 🔍 Check delivery status: https://resend.com/emails/${emailId}`);
      } else {
        console.log(`[resend] 🔍 View all emails: https://resend.com/emails`);
      }
      
      // Note about test domain (only show if using test domain)
      if (fromEmail.includes('onboarding@resend.dev') || fromEmail.includes('resend.dev')) {
        console.log(`[resend] 💡 Note: Using test domain - verify your domain for production use`);
        console.log(`[resend] 💡 Verify domain: https://resend.com/domains`);
      }
      
      return; // Success
    } catch (error) {
      lastError = error;
      const errorMsg = (error?.message || String(error)).toLowerCase();
      const duration = Date.now() - startTime;
      
      // Resend API errors
      const statusCode = error?.status || error?.statusCode || error?.response?.status || error?.code;
      const errorBody = error?.message || error?.response?.data || error?.response?.body;
      
      // Log detailed error information
      console.error(`[resend] Attempt ${attempt + 1}/${maxRetries + 1} failed after ${duration}ms`);
      console.error(`[resend] Status: ${statusCode || 'unknown'}`);
      console.error(`[resend] Error: ${errorMsg.substring(0, 200)}`);
      
      // Log Resend error response if available
      if (errorBody && typeof errorBody === 'object') {
        console.error(`[resend] Resend error response:`, JSON.stringify(errorBody, null, 2));
      } else if (errorBody) {
        console.error(`[resend] Resend error: ${errorBody}`);
      }
      
      const isRetryableError = 
        errorMsg.includes("timeout") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("too many requests") ||
        errorMsg.includes("service unavailable") ||
        errorMsg.includes("internal server error") ||
        errorMsg.includes("econnreset") ||
        errorMsg.includes("econnrefused") ||
        statusCode >= 500 || // Server errors (500, 502, 503, etc.)
        statusCode === 429;   // Rate limit
      
      // 401 and 403 are not retryable - they indicate configuration issues
      if ((statusCode === 401 || statusCode === 403) && attempt < maxRetries) {
        // Don't retry auth errors - they won't succeed
        console.error(`[resend] Auth error (${statusCode}) - not retrying`);
        throw error;
      }
      
      if (isRetryableError && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s
        const delayMs = 1000 * (attempt + 1);
        console.warn(`[resend] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Non-retryable error or out of retries
      throw error;
    }
  }
  
  // Final error - provide helpful message
  console.error(`[resend] ❌ FAILED to send email after ${maxRetries + 1} attempts`);
  console.error(`[resend] Last error: ${lastError?.message}`);
  
  // Check for common errors and provide helpful messages
  const statusCode = lastError?.status || lastError?.statusCode || lastError?.response?.status || lastError?.code;
  const errorBody = lastError?.message || lastError?.response?.data || lastError?.response?.body;
  const fromEmailAddress = extractEmailAddress(fromEmail);
  
  console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.error(`[resend] 📧 Email Details:`);
  console.error(`[resend]   FROM: ${fromEmail || 'NOT SET'}`);
  if (fromEmailAddress && fromEmailAddress !== fromEmail) {
    console.error(`[resend]   FROM (extracted): ${fromEmailAddress}`);
  }
  console.error(`[resend]   TO: ${toEmail || 'NOT SET'}`);
  console.error(`[resend]   Subject: ${subject || 'NOT SET'}`);
  console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Check for credit/quota exhaustion (Resend free tier: 3,000 emails/month, 100/day)
  const errorMessages = (typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody || {})).toLowerCase();
  const isCreditExceeded = 
    errorMessages.includes('quota exceeded') ||
    errorMessages.includes('rate limit') ||
    errorMessages.includes('too many requests') ||
    errorMessages.includes('monthly sending limit') ||
    errorMessages.includes('daily sending limit') ||
    errorMessages.includes('usage limit');
  
  if (isCreditExceeded) {
    console.error(`[resend] ⚠️  QUOTA LIMIT EXCEEDED - Resend Free Tier Quota Reached!`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 💡 The issue:`);
    console.error(`[resend]   Your Resend free tier has run out of email credits.`);
    console.error(`[resend]   Free tier limits:`);
    console.error(`[resend]     • Daily: 100 emails per day (resets every 24 hours)`);
    console.error(`[resend]     • Monthly: 3,000 emails per month (resets on 1st of month)`);
    console.error(`[resend]   The error could be due to EITHER limit being exceeded.`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 🔧 Solutions:`);
    console.error(`[resend]   1. Check your usage to see which limit was hit:`);
    console.error(`[resend]      → Go to: https://resend.com/emails`);
    console.error(`[resend]      → View your sending statistics and remaining credits`);
    console.error(`[resend]   2. If DAILY limit exceeded:`);
    console.error(`[resend]      → Wait ~24 hours for daily reset`);
    console.error(`[resend]      → Daily limits reset every 24 hours (not at midnight)`);
    console.error(`[resend]   3. If MONTHLY limit exceeded:`);
    console.error(`[resend]      → Wait for monthly reset (1st of each month)`);
    console.error(`[resend]      → Or upgrade your Resend plan`);
    console.error(`[resend]   4. Upgrade your Resend plan (if needed):`);
    console.error(`[resend]      → Go to: https://resend.com/pricing`);
    console.error(`[resend]      → Paid plans offer higher limits`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 📌 Note: User creation succeeded, but email was not sent.`);
    console.error(`[resend] 📌 You can manually send credentials to the user or wait for quota reset.`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else if (statusCode === 401 || lastError?.message?.toLowerCase().includes("unauthorized")) {
    console.error(`[resend] ⚠️  UNAUTHORIZED ERROR (401) - Authentication Failed!`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 💡 Possible causes:`);
    console.error(`[resend]   1. Invalid RESEND_API_KEY`);
    console.error(`[resend]   2. API key is revoked or expired`);
    console.error(`[resend]   3. API key format is incorrect (should start with 're_')`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 🔧 How to fix:`);
    console.error(`[resend]   1. Go to: https://resend.com/api-keys`);
    console.error(`[resend]   2. Create a new API key or copy your existing one`);
    console.error(`[resend]   3. Copy the API key (starts with "re_")`);
    console.error(`[resend]   4. Update your .env file: RESEND_API_KEY=re_your_key_here`);
    console.error(`[resend]   5. Restart your server`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else if (statusCode === 403) {
    console.error(`[resend] ⚠️  FORBIDDEN ERROR (403) - Permission Denied!`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 💡 Possible causes:`);
    console.error(`[resend]   1. Domain not verified in Resend`);
    console.error(`[resend]   2. FROM email address (${fromEmailAddress || fromEmail || 'NOT SET'}) domain is not verified`);
    console.error(`[resend]   3. Account is suspended or has sending restrictions`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 🔧 How to fix:`);
    if (fromEmailAddress) {
      console.error(`[resend]   1. Verify your domain in Resend: ${fromEmailAddress.split('@')[1] || 'your-domain.com'}`);
    } else {
      console.error(`[resend]   1. Verify your domain in Resend`);
    }
    console.error(`[resend]      → Go to: https://resend.com/domains`);
    console.error(`[resend]      → Add and verify your domain`);
    console.error(`[resend]      → For testing, you can use: onboarding@resend.dev`);
    console.error(`[resend]   2. Check your API key permissions:`);
    console.error(`[resend]      → Go to: https://resend.com/api-keys`);
    console.error(`[resend]      → Ensure your API key has 'Send Email' permissions`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else if (statusCode === 400) {
    console.error(`[resend] ⚠️  BAD REQUEST ERROR (400) - Invalid Request!`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.error(`[resend] 💡 Possible causes:`);
    console.error(`[resend]   1. Invalid FROM email address format`);
    console.error(`[resend]   2. FROM email domain is not verified`);
    console.error(`[resend]   3. Invalid TO email address format`);
    console.error(`[resend]   4. Missing required email fields`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    if (errorBody) {
      console.error(`[resend] Error details:`, typeof errorBody === 'object' ? JSON.stringify(errorBody, null, 2) : errorBody);
    }
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  } else {
    console.error(`[resend] ⚠️  UNKNOWN ERROR (${statusCode || 'no status code'})`);
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    if (errorBody) {
      console.error(`[resend] Error response:`, typeof errorBody === 'object' ? JSON.stringify(errorBody, null, 2) : errorBody);
    }
    console.error(`[resend] Full error object:`, JSON.stringify({
      message: lastError?.message,
      code: lastError?.code,
      statusCode: statusCode,
      response: errorBody,
    }, null, 2));
    console.error(`[resend] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
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

  const messageId = crypto.randomUUID();

  await sendEmailWithRetry({
    from: getFromEmail(),
    to,
    subject,
    text,
    html,
    headers: {
      ...baseHeaders(),
      "Message-ID": `<otp-${messageId}@${APP_HOST}>`,
    },
  });
}

export async function sendInvitationEmail(to, link) {
  const subject = `You're invited to ${BRAND}`;
  const preheader = "Accept your invitation and set up your account.";

  const safeLink = String(link || "");
  const contentHtml = `
    <p>Hello,</p>
    <p>You've been invited to join <b>${escapeHtml(BRAND)}</b>. Click the button below to set up your account.</p>
    <p style="margin:18px 0"><a class="btn" href="${safeLink}">Accept invitation</a></p>
    <p class="muted">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p class="muted" style="word-break:break-all;">${escapeHtml(safeLink)}</p>
    <p class="muted">If you didn't expect this, you can ignore this email.</p>
  `;
  const html = renderTemplate({ title: "You're invited", preheader, contentHtml });

  const text = `Hello,

You've been invited to join ${BRAND}.

Open this link to set up your account:
${safeLink}

If you didn't expect this, you can ignore this email.`;

  const messageId = crypto.randomUUID();

  await sendEmailWithRetry({
    from: getFromEmail(),
    to,
    subject,
    text,
    html,
    headers: {
      ...baseHeaders(),
      "Message-ID": `<invite-${messageId}@${APP_HOST}>`,
    },
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

  const messageId = crypto.randomUUID();

  await sendEmailWithRetry({
    from: getFromEmail(),
    to,
    subject,
    text,
    html,
    headers: {
      ...baseHeaders(),
      "Message-ID": `<reset-${messageId}@${APP_HOST}>`,
    },
  });
}

export async function verifyMailer() {
  try {
    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn("[resend] Resend not configured - emails will not be sent");
      console.warn("[resend] Required environment variables:");
      console.warn("[resend]   RESEND_API_KEY (your Resend API key starting with 're_')");
      console.warn("[resend]   EMAIL_FROM (e.g., 'ECA Academy <noreply@yourapp.com>')");
      console.warn("[resend] Get your API key from: https://resend.com/api-keys");
      return false;
    }
    
    // Validate API key format
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey.startsWith("re_")) {
      console.warn("[resend] ⚠️  WARNING: API key format looks incorrect!");
      console.warn("[resend] Resend API keys must start with 're_'");
      console.warn("[resend] Get your API key from: https://resend.com/api-keys");
      console.warn("[resend] Create a new API key with 'Send Email' permissions.");
    }
    
    if (!process.env.EMAIL_FROM && !process.env.MAIL_FROM) {
      console.warn("[resend] EMAIL_FROM or MAIL_FROM not configured");
      console.warn("[resend]   EMAIL_FROM (e.g., 'ECA Academy <noreply@yourapp.com>')");
      console.warn("[resend] Note: The FROM email domain must be verified in Resend");
      console.warn("[resend] Verify your domain: https://resend.com/domains");
      console.warn("[resend] For testing, you can use: onboarding@resend.dev");
      return false;
    }
    
    // Verify Resend API key by checking if it's initialized
    if (!resendInitialized) {
      console.warn("[resend] Resend initialization failed");
      return false;
    }
    
    // In production, just verify configuration (don't make API calls on startup)
    if (process.env.NODE_ENV === 'production') {
      console.log("[resend] ✅ Resend configured and ready");
      console.log("[resend] 📧 FROM address:", process.env.EMAIL_FROM || process.env.MAIL_FROM);
      return true;
    }
    
    // In development, log configuration
    console.log("[resend] ✅ Resend configured and ready");
    const fromEmail = process.env.EMAIL_FROM || process.env.MAIL_FROM;
    console.log("[resend] 📧 FROM address:", fromEmail);
    
    // Warn if using test domain
    if (fromEmail && (fromEmail.includes('onboarding@resend.dev') || fromEmail.includes('resend.dev'))) {
      console.log("[resend] ⚠️  DEV MODE: Using test domain (onboarding@resend.dev)");
      console.log("[resend] ⚠️  RESTRICTION: Test domain can ONLY send to your Resend account email");
      console.log("[resend] 📌 Your Resend account email: mithunkumarkulal33@gmail.com");
      console.log("[resend] 💡 For DEV testing:");
      console.log("[resend]     • Send test emails to: mithunkumarkulal33@gmail.com");
      console.log("[resend]     • This is fine for development/testing");
      console.log("[resend] 💡 For PRODUCTION (send to any email):");
      console.log("[resend]     1. Verify your domain: https://resend.com/domains");
      console.log("[resend]     2. Update EMAIL_FROM to: noreply@mygangoor.com");
      console.log("[resend]     3. Restart your server");
    } else if (fromEmail && fromEmail.includes('mygangoor.com')) {
      console.log("[resend] ✅ Using verified domain: mygangoor.com");
      console.log("[resend] 💡 Make sure domain is verified in Resend: https://resend.com/domains");
    }
    
    console.log("[resend] 💡 Test by sending an email (OTP, invitation, etc.)");
    return true;
  } catch (e) {
    const errorMsg = e?.message || String(e);
    console.warn("[resend] verify failed (non-blocking):", errorMsg);
    // Don't throw - allow server to start even if verification fails
    // Emails will be attempted and errors handled at send time
    return false;
  }
}

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
    <p class="muted">If the button doesn't work, copy and paste this URL into your browser:</p>
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

  const messageId = crypto.randomUUID();

  await sendEmailWithRetry({
    from: getFromEmail(),
    to,
    subject,
    text,
    html,
    headers: {
      ...baseHeaders(),
      "Message-ID": `<staff-${messageId}@${APP_HOST}>`,
    },
  });
}
