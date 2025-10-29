# SMTP Email Service Fix for Production (Render)

## Issue
SMTP connection timeouts in production on Render, but works fine locally.

## Root Causes

1. **Render may block outbound SMTP connections** on free tier or certain ports
2. **SMTP server firewall** may block Render's IP addresses
3. **Network latency** causing timeouts (default timeouts too short)
4. **TLS/SSL handshake issues** in production environment

## Solutions Implemented

### 1. Extended Timeout Settings ✅

Added to `backend/src/utils/email.js`:
- `connectionTimeout: 60000` (60 seconds)
- `greetingTimeout: 30000` (30 seconds)
- `socketTimeout: 60000` (60 seconds)

### 2. Better Error Handling ✅

- Non-blocking SMTP verification with 10-second timeout
- Detailed error messages for troubleshooting
- Connection pooling enabled

## Recommended Solutions

### Option 1: Use a Transactional Email Service (RECOMMENDED)

Use API-based email services that work better with cloud platforms:

#### **Resend** (Recommended - Simple & Modern)
```bash
npm install resend
```

Update `backend/src/utils/email.js` to use Resend-swift API instead of SMTP.

#### **SendGrid** (Popular Alternative)
- Sign up at https://sendgrid.com
- Get API key
- Use SendGrid API instead of SMTP

#### **AWS SES** (Scalable)
- Use AWS SES API for better reliability
- Better suited for production workloads

### Option 2: SMTP Relay Service

Use an SMTP relay service that allows connections from any IP:
- **Mailgun** (has SMTP API)
- **Postmark** (has SMTP API)
- **SparkPost** (has SMTP API)

### Option 3: Check Render SMTP Restrictions

1. **Check Render Documentation**: Verify if your plan allows outbound SMTP
2. **Contact Render Support**: Ask if SMTP ports (587, 465) are blocked
3. **Check SMTP Server Settings**: Verify your email provider allows connections from Render

### Option 4: Whitelist Render IPs

If using Gmail or custom SMTP:
1. Get Render's IP address ranges (contact Render support)
2. Whitelist these IPs in your email provider's firewall/security settings
3. Enable "Less secure app access" or use App Passwords (Gmail)

## Environment Variables Setup

### Current SMTP Configuration (Render Backend)

```bash
SMTP_HOST=smtp.gmail.com           # Your SMTP server
SMTP_PORT=587                      # Usually 587 (TLS) or 465 (SSL)
SMTP_SECURE=false                  # true for port 465, false for 587
SMTP_USER=your-email@gmail.com     # Your email address
SMTP_PASS=your-app-password        # App password (not regular password!)
MAIL_FROM=ECA Academy <noreply@yourapp.com>
```

### For Gmail Specifically:

1. Enable 2FA on your Google account
2. Generate an App Password:
   - Go to Google Account → Security
   - Enable 2-Step Verification
   - Go to App Passwords
   - Generate password for "Mail"
3. Use the 16-character app password in `SMTP_PASS`

## Testing SMTP Connection

After deploying changes:

1. Check backend logs on startup - should see:
   ```
   [smtp] transporter is ready
   ```

2. If you see timeout errors, try:
   - Testing with different SMTP port (465 vs 587)
   - Using a different SMTP service
   - Checking firewall/security settings

## Alternative: Quick Test with Different Provider

Test if issue is specific to your SMTP provider:

1. Create a free Mailgun account (1000 emails/month free)
2. Use Mailgun SMTP:
   ```bash
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USER=postmaster@your-domain.mailgun.org
   SMTP_PASS=your-mailgun-password
   ```

## Google OAuth Fix

The Google OAuth error is separate - you need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: APIs & Services → Credentials
3. Select your OAuth 2.0 Client ID
4. Add to **Authorized JavaScript origins**:
   - `https://eca-n7dt.vercel.app`
   - `https://mygangoor.com`
   - `https://www.mygangoor.com`
5. Save changes (takes a few minutes to propagate)

## Notification Bell API Fix

The notification fetch error suggests the API endpoint isn't configured correctly. Ensure:
- `VITE_API_URL` is set correctly on Vercel
- Backend CORS allows the Vercel origin
- The notification endpoint exists and is accessible

## Next Steps

1. **Try the timeout fixes** - Redeploy backend and test
2. **If still timing out**, switch to a transactional email service (Resend/SendGrid)
3. **Fix Google OAuth** by adding authorized origins
4. **Test email sending** - Try forgot password or OTP email flow

ilikiสำหรับ production ที่มีปัญหา connection timeout, แนะนำให้ใช้ transactional email service แทน direct SMTP เพราะเร็วกว่าและ reliable กว่า.

