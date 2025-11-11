# SMTP Email Service Fix for Production (Render)

## Issue
SMTP connection timeouts in production on Render, but works fine locally.

## Root Causes

1. **Render may block outbound SMTP connections** on free tier (port 587 is commonly blocked)
2. **SMTP server firewall** may block Render's IP addresses
3. **Network latency** causing timeouts
4. **Nodemailer timeout settings** may not be respected in some environments

## Solutions Implemented ✅

### 1. Optimized SMTP Configuration

- **Connection pooling disabled** (`pool: false`) - Each email uses a fresh connection
- **Extended timeouts**: 60 seconds (maximum nodemailer allows)
- **Automatic port fallback**: Tries port 2525 if 587 fails
- **Retry logic**: Up to 2 retries with exponential backoff
- **Non-blocking startup**: SMTP verification skipped in production

### 2. Alternative Port Support

If port 587 is blocked, you can use port 2525 (often not blocked):
```bash
SMTP_ALT_PORT=2525
```

### 3. Better Error Handling

- Automatic retry on timeout/connection errors
- Detailed error logging with troubleshooting tips
- Graceful degradation (emails fail silently, don't crash server)

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
SMTP_ALT_PORT=2525                 # OPTIONAL: Alternative port if 587 is blocked
SMTP_SECURE=false                  # true for port 465, false for 587
SMTP_USER=your-email@gmail.com     # Your email address
SMTP_PASS=your-app-password        # App password (not regular password!)
MAIL_FROM=ECA Academy <noreply@yourapp.com>
```

### If Port 587 is Blocked (Render Free Tier)

1. **Try Port 2525** (often not blocked):
   ```bash
   SMTP_ALT_PORT=2525
   ```
   Or set it as primary:
   ```bash
   SMTP_PORT=2525
   ```

2. **Contact Render Support**:
   - Ask them to unblock port 587 for outbound SMTP
   - Or request access to port 2525

3. **Check SMTP Provider**:
   - Some providers (like Gmail) support multiple ports
   - Check if your SMTP provider supports port 2525

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

## Troubleshooting Connection Timeouts

### If you're still getting timeouts:

1. **Check Render Logs**:
   - Look for `[smtp]` messages in logs
   - Check if it's trying alternative ports

2. **Try Alternative Port**:
   ```bash
   # In Render environment variables:
   SMTP_ALT_PORT=2525
   ```
   Then redeploy

3. **Verify SMTP Provider Supports Port 2525**:
   - Gmail: Only supports 587 and 465
   - Many providers support 2525 as alternative
   - Check your SMTP provider's documentation

4. **Contact Render Support**:
   - Explain that SMTP port 587 is timing out
   - Ask if outbound SMTP is blocked on free tier
   - Request port 587 to be unblocked

5. **Last Resort - Use Transactional Email Service**:
   - **Mailgun** (free tier: 100 emails/day for 3 months)
   - **SendGrid** (free tier: 100 emails/day)
   - **Resend** (free tier: 3000 emails/month)
   - These use HTTP API instead of SMTP (not blocked)

## Current Implementation Status

✅ **Connection pooling disabled** - Fresh connection per email  
✅ **Automatic retry logic** - Up to 2 retries with backoff  
✅ **Alternative port support** - Tries 2525 if 587 fails  
✅ **Non-blocking startup** - Server starts even if SMTP fails  
✅ **Better error messages** - Helpful troubleshooting tips  

## Next Steps

1. **Deploy the latest changes** - The code now handles timeouts better
2. **Set SMTP_ALT_PORT=2525** if port 587 is blocked
3. **Monitor logs** - Check for `[smtp]` messages
4. **Test email sending** - Try forgot password or OTP email flow
5. **If still failing**, consider switching to a transactional email service (Mailgun, SendGrid, Resend)

**Note**: Render's free tier may block SMTP port 587. Port 2525 is often not blocked and works as an alternative.

