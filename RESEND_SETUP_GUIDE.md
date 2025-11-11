# Resend Email Service Setup Guide

## Overview
This guide will help you set up Resend for sending emails in your application. Resend is a modern email API service that provides reliable email delivery.

## Step 1: Create a Resend Account

1. **Sign up for Resend**
   - Go to: https://resend.com/signup
   - Sign up with your email address
   - Verify your email address

## Step 2: Get Your API Key

1. **Navigate to API Keys**
   - Go to: https://resend.com/api-keys
   - Click "Create API Key"
   - Give it a name (e.g., "Production API Key" or "Development API Key")
   - Select permissions: **"Send Email"** (required)
   - Click "Create"
   - **Copy the API key immediately** (it starts with `re_`)
   - ⚠️ **Important**: You won't be able to see the full key again after closing the dialog

## Step 3: Verify Your Domain (For Production)

### Option A: Use Resend's Test Domain (For Development/Testing)

For testing, you can use Resend's test domain without verification:
- **FROM email**: `onboarding@resend.dev`
- This works immediately but emails will have "via resend.dev" in the sender
- Perfect for development and testing

### Option B: Verify Your Own Domain (For Production)

1. **Add Domain in Resend**
   - Go to: https://resend.com/domains
   - Click "Add Domain"
   - Enter your domain (e.g., `yourdomain.com`)
   - Click "Add"

2. **Verify Domain with DNS Records**
   - Resend will provide DNS records you need to add:
     - **SPF Record** (TXT record)
     - **DKIM Records** (CNAME records)
     - **DMARC Record** (TXT record) - Optional but recommended
   
3. **Add DNS Records**
   - Go to your domain's DNS provider (e.g., Cloudflare, Namecheap, GoDaddy)
   - Add the DNS records provided by Resend
   - Wait for DNS propagation (can take a few minutes to 48 hours)

4. **Verify Domain**
   - Go back to Resend dashboard
   - Click "Verify" next to your domain
   - Wait for verification to complete
   - Once verified, you can use any email from that domain (e.g., `noreply@yourdomain.com`)

## Step 4: Configure Environment Variables

Add the following to your `.env` file:

```env
# Resend API Key (starts with 're_')
RESEND_API_KEY=re_your_api_key_here

# FROM email address
# For testing: onboarding@resend.dev
# For production: your-verified-domain email (e.g., noreply@yourdomain.com)
EMAIL_FROM=onboarding@resend.dev

# Or with a name:
# EMAIL_FROM=ECA Academy <noreply@yourdomain.com>
```

## Step 5: Install Dependencies

The Resend package has already been installed. If you need to reinstall:

```bash
cd backend
npm install resend
```

## Step 6: Test Email Sending

1. **Start your server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Check startup logs**
   - You should see: `[resend] ✅ Resend configured and ready`
   - You should see: `[resend] 📧 FROM address: onboarding@resend.dev`

3. **Test by creating a user**
   - Try creating a user in the admin dashboard
   - Check server logs for email sending status
   - Check the user's email inbox for the credentials email

## Resend Free Tier Limits

- **Daily Limit**: 100 emails per day
- **Monthly Limit**: 3,000 emails per month
- **Resets**: Daily limit resets every 24 hours, monthly limit resets on the 1st of each month

## Troubleshooting

### Error: "Unauthorized" (401)
- **Cause**: Invalid API key
- **Solution**: 
  1. Check your `RESEND_API_KEY` in `.env` file
  2. Ensure it starts with `re_`
  3. Verify the key is correct in Resend dashboard
  4. Restart your server

### Error: "Forbidden" (403)
- **Cause**: Domain not verified
- **Solution**:
  1. Verify your domain in Resend dashboard
  2. For testing, use `onboarding@resend.dev`
  3. Check DNS records are correctly added
  4. Wait for DNS propagation

### Error: "Bad Request" (400)
- **Cause**: Invalid email format or unverified domain
- **Solution**:
  1. Check `EMAIL_FROM` format in `.env`
  2. Ensure domain is verified in Resend
  3. For testing, use `onboarding@resend.dev`

### Error: "Quota Exceeded"
- **Cause**: Free tier limits reached
- **Solution**:
  1. Check usage at: https://resend.com/emails
  2. Wait for daily/monthly reset
  3. Upgrade to a paid plan if needed

## Resend Dashboard Links

- **API Keys**: https://resend.com/api-keys
- **Domains**: https://resend.com/domains
- **Emails**: https://resend.com/emails (view sent emails and statistics)
- **Pricing**: https://resend.com/pricing
- **Documentation**: https://resend.com/docs

## Next Steps

1. ✅ Get your Resend API key
2. ✅ Add `RESEND_API_KEY` to your `.env` file
3. ✅ Set `EMAIL_FROM` to `onboarding@resend.dev` (for testing) or your verified domain email (for production)
4. ✅ Restart your server
5. ✅ Test by creating a user
6. ✅ Verify your domain for production use

## Support

- **Resend Documentation**: https://resend.com/docs
- **Resend Support**: https://resend.com/support
- **Resend Status**: https://status.resend.com

