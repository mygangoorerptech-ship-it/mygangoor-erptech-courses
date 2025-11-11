# Email Delivery Troubleshooting Guide

## Issue: Email Sent but Not Received

If your emails are being sent successfully but not received, follow these troubleshooting steps:

## Step 1: Check Resend Dashboard

1. **Go to Resend Dashboard**
   - Visit: https://resend.com/emails
   - Login to your Resend account
   - Look for the email you just sent

2. **Check Delivery Status**
   - **Delivered**: Email was successfully delivered to recipient's mailbox
   - **Pending**: Email is queued and will be sent soon
   - **Bounced**: Email was rejected by recipient's email server
   - **Failed**: Email delivery failed (check error message)
   - **Opened**: Email was opened by recipient (if tracking enabled)

3. **Check for Errors**
   - Look for any error messages or warnings
   - Check bounce reasons if email bounced
   - Check spam reports if available

## Step 2: Check Spam/Junk Folder

**Most Common Issue**: Test domain emails often go to spam/junk folder

1. **Check Spam Folder**
   - Open the recipient's email inbox
   - Check the **Spam** or **Junk** folder
   - Look for emails from `onboarding@resend.dev` or your FROM address
   - Mark as "Not Spam" if found

2. **Why Test Domain Emails Go to Spam**
   - Test domains have low sender reputation
   - Email providers (Gmail, Outlook) are more suspicious of test domains
   - Test domain emails show "via resend.dev" in sender
   - Higher spam score = more likely to be filtered

## Step 3: Verify Your Domain (RECOMMENDED)

**Best Solution**: Verify your own domain for better deliverability

### Why Verify Your Domain?

- ✅ **Better Deliverability**: Verified domains have much higher inbox rates
- ✅ **Professional Appearance**: Emails come from your domain (not "via resend.dev")
- ✅ **Higher Reputation**: Build your domain's sender reputation
- ✅ **Less Spam Filtering**: Verified domains are less likely to be marked as spam
- ✅ **Better for Production**: Required for production use

### How to Verify Your Domain

1. **Add Domain in Resend**
   - Go to: https://resend.com/domains
   - Click "Add Domain"
   - Enter your domain (e.g., `yourdomain.com`)
   - Click "Add"

2. **Add DNS Records**
   Resend will provide DNS records to add:
   - **SPF Record** (TXT record)
   - **DKIM Records** (CNAME records - usually 2-3 records)
   - **DMARC Record** (TXT record - optional but recommended)

3. **Add DNS Records in Your DNS Provider**
   - Go to your domain's DNS provider (Cloudflare, Namecheap, GoDaddy, etc.)
   - Add the DNS records provided by Resend
   - Wait for DNS propagation (can take a few minutes to 48 hours)

4. **Verify Domain**
   - Go back to Resend dashboard
   - Click "Verify" next to your domain
   - Wait for verification to complete
   - Once verified, you can use any email from that domain

5. **Update Environment Variables**
   ```env
   # Use your verified domain email
   EMAIL_FROM=noreply@yourdomain.com
   # Or with name:
   EMAIL_FROM=ECA Academy <noreply@yourdomain.com>
   ```

6. **Restart Your Server**
   ```bash
   # Restart your server to load new environment variables
   npm run dev
   ```

## Step 4: Check Email Provider Filters

Some email providers (Gmail, Outlook) may block or delay test domain emails:

1. **Gmail**
   - Check "Spam" folder
   - Check "All Mail" folder
   - Check "Promotions" tab (if using Gmail tabs)
   - Gmail may delay test domain emails

2. **Outlook**
   - Check "Junk Email" folder
   - Check "Other" folder
   - Outlook may block test domain emails

3. **Other Providers**
   - Check spam/junk folder
   - Check quarantine folder
   - Check blocked senders list

## Step 5: Test with Different Email Addresses

1. **Test with Gmail**
   - Try sending to a Gmail address
   - Check spam folder
   - Check if email is delivered

2. **Test with Outlook**
   - Try sending to an Outlook address
   - Check junk folder
   - Check if email is delivered

3. **Test with Other Providers**
   - Try different email providers
   - Compare deliverability rates
   - Identify which providers block test domain emails

## Step 6: Check Resend Logs

1. **View Email Logs**
   - Go to: https://resend.com/emails
   - Click on the email you sent
   - Check delivery status
   - Check for any errors or warnings

2. **Check Bounce Reports**
   - Go to: https://resend.com/emails
   - Look for bounced emails
   - Check bounce reasons
   - Fix any issues (invalid email, domain issues, etc.)

## Common Issues and Solutions

### Issue 1: Email in Spam Folder
**Solution**: 
- Check spam/junk folder
- Mark as "Not Spam"
- Verify your domain for better deliverability

### Issue 2: Email Blocked by Provider
**Solution**: 
- Verify your domain
- Use verified domain email
- Check bounce reports in Resend dashboard

### Issue 3: Email Delayed
**Solution**: 
- Wait a few minutes (emails can be delayed)
- Check Resend dashboard for delivery status
- Verify your domain for faster delivery

### Issue 4: Test Domain Poor Deliverability
**Solution**: 
- Verify your domain (BEST SOLUTION)
- Use verified domain email
- This will significantly improve deliverability

## Quick Fix Checklist

- [ ] Check spam/junk folder in recipient's inbox
- [ ] Check Resend dashboard: https://resend.com/emails
- [ ] Verify your domain: https://resend.com/domains
- [ ] Update EMAIL_FROM to use verified domain
- [ ] Restart your server
- [ ] Test again with verified domain email
- [ ] Check delivery status in Resend dashboard

## Next Steps

1. **Immediate Fix**: Check spam/junk folder
2. **Short-term Fix**: Verify your domain in Resend
3. **Long-term Fix**: Use verified domain email for all emails
4. **Monitor**: Check Resend dashboard regularly for delivery issues

## Support

- **Resend Dashboard**: https://resend.com/emails
- **Resend Domains**: https://resend.com/domains
- **Resend Documentation**: https://resend.com/docs
- **Resend Support**: https://resend.com/support

