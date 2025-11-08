# Trace Quick Start Guide

## ✅ What I Just Fixed

1. **Login Screen**: Updated `apps/mobile/App.tsx` to show login/signup screens
2. **Built Code**: Rebuilt core package successfully

## 🚀 Two Things You Need to Do Now

### 1. Apply Database Migrations (2 minutes)

Your Supabase database is empty - you need to create the tables.

**Quick Steps:**

1. Open https://app.supabase.com
2. Select your Trace project
3. Click **SQL Editor** (left sidebar)
4. Click **"New query"**
5. Open this file: `C:\projects\trace\supabase\migrations\20250101000000_initial_schema.sql`
6. **Copy ALL contents** (192 lines)
7. **Paste into Supabase SQL Editor**
8. Click **"Run"** (or Ctrl+Enter)
9. You should see: "Success. No rows returned"

10. Click **"New query"** again
11. Open this file: `C:\projects\trace\supabase\migrations\20250101000001_rls_policies.sql`
12. **Copy ALL contents**
13. **Paste into SQL Editor**
14. Click **"Run"**
15. You should see: "Success. No rows returned"

**Verify it worked:**
- Click **Table Editor** (left sidebar)
- You should see: `categories` and `entries` tables

### 2. Configure Supabase Credentials (1 minute)

1. In Supabase dashboard, click **Settings** (gear icon) → **API**
2. Copy these two values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJxxxx...`

3. Create config file:
   ```bash
   cp packages/core/config.json.example packages/core/config.json
   ```

4. Edit `packages/core/config.json` and paste your values:
   ```json
   {
     "supabase": {
       "url": "https://YOUR-PROJECT-ID.supabase.co",
       "anonKey": "YOUR-ANON-KEY-HERE"
     },
     "environment": "development"
   }
   ```

5. Save the file

## 🎉 Test the App

Now you can test the login:

```bash
npm run dev:mobile
```

**What you should see:**

1. App starts → Loading spinner briefly
2. **Login screen appears** with:
   - Email input
   - Password input
   - "Sign In" button
   - "Continue with Google" button
   - "Sign Up" link

**Try signing up:**

1. Click "Sign Up" link
2. Enter email: `test@example.com`
3. Enter password: `password123`
4. Enter confirm password: `password123`
5. Click "Create Account"

**What happens:**

- ✅ If successful: You'll see "Welcome to Trace! Logged in as: test@example.com"
- ❌ If error: Alert will show the error message

**Note:** Email verification is optional - you can disable it in Supabase:
- Go to **Authentication** → **Settings**
- Disable "Enable email confirmations" for testing

## 🐛 Troubleshooting

### "Supabase configuration missing" Error

**Fix:** Make sure you created `packages/core/config.json` with valid credentials (Step 2 above)

### "relation 'categories' does not exist" Error

**Fix:** You didn't apply the migrations yet. Do Step 1 above.

### Login Button Does Nothing

**Fix:** Check the error in the alert dialog. Common issues:
- Invalid email format
- Password too short (min 6 characters)
- Email already exists (try a different email)
- Supabase credentials wrong

### No Login Screen Shows

**Fix:** You probably have a build error. Run:
```bash
npm run build:shared
npm run type-check
```

Look for TypeScript errors and fix them.

## 📊 What's Configured

After these steps, you'll have:

- ✅ Database tables (entries, categories)
- ✅ Row-Level Security policies
- ✅ Email/password authentication
- ✅ Login/Signup screens
- ✅ Session management
- ✅ Secure token storage

## 🎯 Next Steps

Once login works:

1. **Enable Google OAuth** (optional):
   - Follow `AUTHENTICATION_SETUP.md` for Google setup
   - Takes ~15 minutes to configure Google Cloud Console

2. **Build entry capture feature** (Feature 1):
   - Create entry input screen
   - Implement rich text editing
   - Add category selection

3. **Build inbox view** (Feature 2):
   - Show list of uncategorized entries
   - Implement swipe actions

**Total setup time: 3 minutes**

Let me know when you've completed these steps and I'll help with the next feature!
