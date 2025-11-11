# How to Update EMAIL_FROM Environment Variable

## Current Issue
Your `EMAIL_FROM` is set to `onboarding@resend.dev` (test domain), which can only send to your account email.

## Solution
Update `EMAIL_FROM` to use your verified domain: `mygangoor.com`

## Steps

### 1. Open Your .env File

Navigate to your backend directory and open the `.env` file:

```bash
cd backend
# Open .env file in your text editor
```

### 2. Find or Add EMAIL_FROM

Look for this line in your `.env` file:

```env
EMAIL_FROM=onboarding@resend.dev
```

Or if it doesn't exist, add it.

### 3. Update to Use Your Verified Domain

Change it to:

```env
EMAIL_FROM=noreply@mygangoor.com
```

Or with a name:

```env
EMAIL_FROM=MyGangoor <noreply@mygangoor.com>
```

### 4. Save the File

Save the `.env` file.

### 5. Restart Your Server

Stop your server (Ctrl+C) and restart it:

```bash
npm run dev
# or
nodemon server.js
```

### 6. Verify the Change

Check your server logs. You should see:

```
[resend] ✅ Resend configured and ready
[resend] 📧 FROM address: noreply@mygangoor.com
```

## For Production (Render)

If you're deploying to Render:

1. Go to Render Dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Find `EMAIL_FROM` variable
5. Update to: `noreply@mygangoor.com`
6. Save (this will trigger a redeploy)

## Important Notes

- ⚠️ **Domain must be verified first**: Make sure `mygangoor.com` is verified in Resend before updating `EMAIL_FROM`
- ⚠️ **DNS records must be added**: Add all DNS records to your domain provider first
- ⚠️ **Wait for verification**: Wait for domain verification to complete before updating `EMAIL_FROM`

## Example .env File

```env
# Resend API Key
RESEND_API_KEY=re_your_api_key_here

# FROM email address (use your verified domain)
EMAIL_FROM=noreply@mygangoor.com

# Other environment variables...
MONGODB_URI=...
PORT=...
```

## After Update

1. ✅ Restart your server
2. ✅ Test email sending
3. ✅ Check server logs for success
4. ✅ Verify email delivery in Resend dashboard

