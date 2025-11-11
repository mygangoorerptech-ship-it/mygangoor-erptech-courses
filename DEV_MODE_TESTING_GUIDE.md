# Dev Mode Testing Guide - Resend Email

## Dev Mode Testing (No Domain Verification Required)

### ✅ What You CAN Do in Dev Mode

1. **Use Test Domain**: `onboarding@resend.dev` (no verification needed)
2. **Send Test Emails**: Send emails for testing your application
3. **Test Email Templates**: Verify email content and formatting
4. **Test Email Flow**: Test invitation, password reset, OTP emails

### ⚠️ Important Restriction

**Test domain can ONLY send to your Resend account email:**
- ✅ **Your Resend account email**: `mithunkumarkulal33@gmail.com`
- ❌ **Other emails**: Will fail with 403 error

### Why This Restriction Exists

- Prevents spam and abuse
- Allows testing without domain verification
- Free tier limitation for test domain

## Dev Mode Setup

### 1. Keep Using Test Domain

Your `.env` file should have:

```env
# Resend API Key
RESEND_API_KEY=re_your_api_key_here

# Test domain (no verification needed)
EMAIL_FROM=onboarding@resend.dev
```

### 2. Test with Your Resend Account Email

For dev mode testing, send test emails to:
- **Email**: `mithunkumarkulal33@gmail.com`
- **Why**: This is your Resend account email
- **Result**: Emails will be delivered successfully

### 3. Test User Creation

When creating test users in admin dashboard:
1. Use email: `mithunkumarkulal33@gmail.com`
2. Emails will be sent successfully
3. Check your inbox for test emails

## Example: Testing User Creation

### ✅ This Will Work (Dev Mode)

```javascript
// Create user with your Resend account email
{
  email: "mithunkumarkulal33@gmail.com",
  name: "Test User",
  role: "student"
}
```

**Result**: ✅ Email sent successfully

### ❌ This Will Fail (Dev Mode)

```javascript
// Create user with different email
{
  email: "mithunkumar343443@gmail.com",
  name: "Test User",
  role: "student"
}
```

**Result**: ❌ 403 Error - Test domain can only send to account owner's email

## Dev Mode Testing Workflow

### Step 1: Start Your Server

```bash
cd backend
npm run dev
# or
nodemon server.js
```

### Step 2: Check Server Logs

You should see:
```
[resend] ✅ Resend configured and ready
[resend] 📧 FROM address: onboarding@resend.dev
[resend] ⚠️  DEV MODE: Using test domain (onboarding@resend.dev)
[resend] ⚠️  RESTRICTION: Test domain can ONLY send to your Resend account email
[resend] 📌 Your Resend account email: mithunkumarkulal33@gmail.com
```

### Step 3: Create Test Users

1. Go to admin dashboard
2. Create user with email: `mithunkumarkulal33@gmail.com`
3. Check server logs for success
4. Check your email inbox

### Step 4: Test Email Templates

- Test invitation emails
- Test password reset emails
- Test OTP emails
- Test staff credentials emails

## Dev Mode vs Production Mode

### Dev Mode (Current Setup)

```env
EMAIL_FROM=onboarding@resend.dev
```

**Pros:**
- ✅ No domain verification needed
- ✅ Quick setup
- ✅ Good for testing

**Cons:**
- ❌ Can only send to your Resend account email
- ❌ Not suitable for production
- ❌ Limited testing capabilities

### Production Mode (After Domain Verification)

```env
EMAIL_FROM=noreply@mygangoor.com
```

**Pros:**
- ✅ Can send to any email address
- ✅ Professional appearance
- ✅ Better deliverability
- ✅ Production ready

**Cons:**
- ❌ Requires domain verification
- ❌ Requires DNS records setup
- ❌ Takes time to set up

## Testing Checklist

### Dev Mode Testing

- [ ] Server running with test domain
- [ ] `EMAIL_FROM=onboarding@resend.dev` in `.env`
- [ ] Creating test users with your Resend account email
- [ ] Receiving test emails in your inbox
- [ ] Testing all email templates
- [ ] Verifying email content and formatting

### Production Mode Testing (Later)

- [ ] Domain verified in Resend
- [ ] DNS records added
- [ ] `EMAIL_FROM=noreply@mygangoor.com` in `.env`
- [ ] Creating users with any email address
- [ ] Emails delivered successfully
- [ ] Professional email appearance

## Quick Reference

### Test Domain Restrictions

| What | Test Domain | Verified Domain |
|------|-------------|----------------|
| Domain Verification | ❌ Not required | ✅ Required |
| Send to Any Email | ❌ No (only account email) | ✅ Yes |
| Send to Account Email | ✅ Yes | ✅ Yes |
| Production Ready | ❌ No | ✅ Yes |
| Setup Time | ⚡ Instant | ⏱️ 5-30 minutes |

### Your Resend Account Email

- **Email**: `mithunkumarkulal33@gmail.com`
- **Use for**: Dev mode testing
- **Limitation**: Test domain can ONLY send to this email

## Troubleshooting

### Getting 403 Error in Dev Mode?

**Cause**: Trying to send to email other than your Resend account email

**Solution**: 
1. Use your Resend account email: `mithunkumarkulal33@gmail.com`
2. Or verify your domain for production use

### Not Receiving Test Emails?

**Check:**
1. Server logs for success message
2. Spam/junk folder
3. Resend dashboard: https://resend.com/emails
4. Email address is correct: `mithunkumarkulal33@gmail.com`

### Want to Test with Other Emails?

**Option 1**: Verify your domain (recommended for production)
- Follow domain verification guide
- Update `EMAIL_FROM` to use verified domain
- Send to any email address

**Option 2**: Use Resend account email for testing
- Keep using test domain
- Send test emails to your Resend account email
- Good for development/testing

## Summary

### For Dev Mode Testing:
- ✅ Use test domain: `onboarding@resend.dev`
- ✅ Send test emails to: `mithunkumarkulal33@gmail.com`
- ✅ No domain verification needed
- ✅ Perfect for development/testing

### For Production:
- ✅ Verify your domain: `mygangoor.com`
- ✅ Update `EMAIL_FROM` to: `noreply@mygangoor.com`
- ✅ Send to any email address
- ✅ Production ready

## Next Steps

1. **For Dev Mode**: Continue using test domain with your Resend account email
2. **For Production**: Verify your domain when ready for production use
3. **Testing**: Use `mithunkumarkulal33@gmail.com` for all test emails in dev mode

Happy testing! 🚀

