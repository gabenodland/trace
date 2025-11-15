# Google OAuth Setup for Expo Development

Complete guide to configure Google OAuth for testing with Expo.

---

## Part 1: Google Cloud Console Configuration

### Step 1: Go to Your OAuth Client
1. Open https://console.cloud.google.com
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID (the one for Trace)

### Step 2: Add Authorized Redirect URIs

In the **Authorized redirect URIs** section, add ALL of these:

#### For Supabase (REQUIRED):
```
https://lsszorssvkavegobmqic.supabase.co/auth/v1/callback
```

#### For Expo Go Development (REQUIRED for testing):
```
exp://localhost:8081/--/auth/callback
exp://192.168.86.76:8081/--/auth/callback
```

#### For Production (Add later when building standalone app):
```
exp://u.expo.dev/[your-project-id]/--/auth/callback
```

### Step 3: Add Authorized JavaScript Origins

In the **Authorized JavaScript origins** section, add:

```
https://lsszorssvkavegobmqic.supabase.co
http://localhost:8081
```

### Step 4: Save Changes
Click **Save** at the bottom

---

## Part 2: Supabase Configuration

### Step 1: Configure Google Provider
1. Go to https://app.supabase.com/project/lsszorssvkavegobmqic
2. Click **Authentication** → **Providers**
3. Find **Google** and toggle **Enable**
4. Enter your Google OAuth credentials:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)
5. Click **Save**

### Step 2: Add Redirect URLs in Supabase
1. Still in **Authentication**, click **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   exp://localhost:8081
   exp://192.168.86.76:8081
   http://localhost:3000
   ```
3. Click **Save**

---

## Part 3: Test the Setup

### Step 1: Get Your Local IP (if different)
If Expo is running on a different IP, check the terminal output:
```
› Opening exp://192.168.X.X:8081
```
Use that IP instead of 192.168.86.76

### Step 2: Update Google Cloud Console
If your IP is different, go back to Google Cloud Console and update the redirect URI:
```
exp://YOUR_IP_HERE:8081/--/auth/callback
```

### Step 3: Test Google Sign-In
1. Open your app in Expo Go
2. Click "Continue with Google"
3. Should open Google sign-in
4. Select your account
5. Should redirect back to app
6. You should be logged in!

---

## Troubleshooting

### Error: "redirect_uri_mismatch"
**Problem**: Google doesn't recognize the redirect URI

**Solution**:
1. Check the error message for the exact redirect_uri Google received
2. Copy that EXACT URL
3. Add it to Google Cloud Console Authorized redirect URIs
4. Wait 5 minutes for changes to propagate
5. Try again

### Error: "access_denied"
**Problem**: User cancelled or Google OAuth not enabled in Supabase

**Solution**:
1. Verify Google provider is enabled in Supabase
2. Check Client ID/Secret are correct
3. Try signing in again

### Error: "Invalid redirect URL"
**Problem**: Supabase doesn't recognize the redirect URL

**Solution**:
1. Go to Supabase Authentication → URL Configuration
2. Add your Expo development URL to Redirect URLs
3. Save and try again

### Google Sign-In Opens But Doesn't Redirect Back
**Problem**: Expo deep linking not configured

**Solution**:
1. Check your app.json has correct scheme
2. Restart Expo with `--clear` flag
3. Reload app in Expo Go

---

## Quick Reference

### Your Supabase Project
- **Project Ref**: `lsszorssvkavegobmqic`
- **URL**: `https://lsszorssvkavegobmqic.supabase.co`
- **Dashboard**: https://app.supabase.com/project/lsszorssvkavegobmqic

### Redirect URIs to Add (Copy/Paste)
```
https://lsszorssvkavegobmqic.supabase.co/auth/v1/callback
exp://localhost:8081/--/auth/callback
exp://192.168.86.76:8081/--/auth/callback
```

### JavaScript Origins to Add (Copy/Paste)
```
https://lsszorssvkavegobmqic.supabase.co
http://localhost:8081
```

---

## Notes

- Changes in Google Cloud Console can take 5-10 minutes to propagate
- You may need to restart Expo after Google OAuth changes
- For production builds, you'll need to add additional URIs
- Keep Client Secret secure - never commit to git

---

**Estimated Setup Time: 5 minutes**
