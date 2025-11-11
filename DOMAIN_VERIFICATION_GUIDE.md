# Domain Verification Guide for Resend

## Which Domain to Verify?

### ❌ NOT These Domains:
- `eca-uvco.onrender.com` (Backend hosting - Render)
- `eca-n7dt.vercel.app` (Frontend hosting - Vercel)
- `localhost` or `127.0.0.1` (Local development)

### ✅ Verify This Domain:
- **`mygangoor.com`** (Your production domain)

## Why Verify `mygangoor.com`?

1. **Email Domain**: This is the domain you'll use in your FROM email address
2. **Professional**: Emails will come from `noreply@mygangoor.com` (not `onboarding@resend.dev`)
3. **Branding**: Recipients will see your domain in the sender address
4. **Deliverability**: Verified domains have much better email deliverability

## Step-by-Step Instructions

### Step 1: Add Domain in Resend

1. Go to: **https://resend.com/domains**
2. Click **"Add Domain"**
3. Enter: **`mygangoor.com`**
4. Click **"Add"**

### Step 2: Add DNS Records

Resend will show you DNS records to add. You'll need to add these in your domain provider (where you bought `mygangoor.com`):

#### DNS Records to Add:

1. **SPF Record** (TXT record)
   - Name: `@` or `mygangoor.com`
   - Type: `TXT`
   - Value: `v=spf1 include:resend.com ~all`

2. **DKIM Records** (CNAME records - usually 2-3 records)
   - Name: `resend._domainkey` (or similar)
   - Type: `CNAME`
   - Value: (Provided by Resend)

3. **DMARC Record** (TXT record - optional but recommended)
   - Name: `_dmarc`
   - Type: `TXT`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@mygangoor.com`

### Step 3: Add DNS Records in Your Domain Provider

**Common Domain Providers:**
- **Cloudflare**: DNS → Records → Add record
- **Namecheap**: Domain List → Manage → Advanced DNS
- **GoDaddy**: DNS Management → Add
- **Google Domains**: DNS → Custom records

**Steps:**
1. Log in to your domain provider
2. Go to DNS management
3. Add each DNS record provided by Resend
4. Save changes
5. Wait for DNS propagation (5-30 minutes, sometimes up to 48 hours)

### Step 4: Verify Domain in Resend

1. Go back to: **https://resend.com/domains**
2. Find `mygangoor.com` in the list
3. Click **"Verify"** (or it may auto-verify)
4. Wait for verification to complete
5. Once verified, you'll see a green checkmark ✅

### Step 5: Update Environment Variables

**On Render (Backend):**

1. Go to Render Dashboard → Your Backend Service
2. Go to "Environment" tab
3. Update `EMAIL_FROM`:
   ```env
   EMAIL_FROM=noreply@mygangoor.com
   ```
   Or with name:
   ```env
   EMAIL_FROM=MyGangoor <noreply@mygangoor.com>
   ```
4. Save (this will trigger a redeploy)

**On Local Development (.env file):**

Update your local `.env` file:
```env
EMAIL_FROM=noreply@mygangoor.com
```

### Step 6: Restart Your Server

```bash
# Restart your server to load new environment variables
npm run dev
# or
nodemon server.js
```

## Verification Checklist

- [ ] Domain added in Resend: `mygangoor.com`
- [ ] SPF record added in DNS provider
- [ ] DKIM records added in DNS provider
- [ ] DMARC record added in DNS provider (optional)
- [ ] DNS records propagated (check with `nslookup` or DNS checker)
- [ ] Domain verified in Resend (green checkmark ✅)
- [ ] `EMAIL_FROM` updated to use `mygangoor.com` domain
- [ ] Server restarted
- [ ] Test email sent successfully

## Testing

After verification:

1. **Test Email Sending**:
   - Create a user in admin dashboard
   - Check if email is sent successfully
   - Check server logs for success message

2. **Check Email Delivery**:
   - Go to: **https://resend.com/emails**
   - Look for your test email
   - Check delivery status

3. **Verify FROM Address**:
   - Check the recipient's inbox
   - Verify the FROM address shows `noreply@mygangoor.com`
   - Verify it's not in spam folder

## Troubleshooting

### Domain Not Verifying?

1. **Check DNS Records**:
   - Use DNS checker: https://dnschecker.org
   - Verify all records are propagated
   - Check for typos in DNS records

2. **Wait for Propagation**:
   - DNS changes can take 5-30 minutes
   - Sometimes up to 48 hours
   - Be patient and check again later

3. **Check Resend Dashboard**:
   - Go to: https://resend.com/domains
   - Look for error messages
   - Check which records are missing

### Still Getting 403 Error?

1. **Verify Domain is Verified**:
   - Check Resend dashboard for green checkmark ✅
   - Make sure domain is fully verified

2. **Check EMAIL_FROM**:
   - Verify `EMAIL_FROM` uses `mygangoor.com` domain
   - Not `onboarding@resend.dev`
   - Format: `noreply@mygangoor.com`

3. **Restart Server**:
   - Restart your server after updating `EMAIL_FROM`
   - Check server logs for confirmation

## Benefits of Domain Verification

✅ **Better Deliverability**: Verified domains have much higher inbox rates  
✅ **Professional Appearance**: Emails come from your domain  
✅ **No Restrictions**: Send to any email address  
✅ **Better Reputation**: Build your domain's sender reputation  
✅ **Production Ready**: Required for production use  

## Summary

- **Verify**: `mygangoor.com` (your production domain)
- **NOT**: `eca-uvco.onrender.com` or `eca-n7dt.vercel.app` (hosting domains)
- **Use**: `noreply@mygangoor.com` in `EMAIL_FROM`
- **Result**: Emails will be sent from your domain to any recipient

