# WINGGO — Firebase New Project Setup Checklist

> **Important:** No code changes are needed. All Firebase credentials are stored
> as Replit Secrets. Swapping to a new project = updating 7 secret values.

---

## Step 1 — Create New Firebase Project

1. Go to **console.firebase.google.com** — sign in with your **new Gmail account**
2. Click **"Add project"** → name it `winggo` (or `winggo-prod`)
3. Disable Google Analytics → **Create project**

---

## Step 2 — Enable Phone Authentication (OTP Login)

1. Sidebar → **Build → Authentication → Get started**
2. Click **Sign-in method** tab → Click **Phone** → Enable → **Save**
3. *(Optional)* Add test phone numbers under "Phone numbers for testing"

> ⚠️ **Real Indian SMS requires the Blaze (pay-as-you-go) plan.**
> Free Spark plan only allows pre-configured test numbers.

---

## Step 3 — Create Firestore Database

1. Sidebar → **Build → Firestore Database → Create database**
2. **Start in production mode** → Next
3. Region: **asia-south1** (Mumbai) → Enable
4. Go to **Rules** tab → paste the security rules from `firestore.rules`

---

## Step 4 — Create Realtime Database

1. Sidebar → **Build → Realtime Database → Create Database**
2. Region: **asia-southeast1** (Singapore) → Next → Locked mode → Enable
3. **Rules** tab → paste:
   ```json
   { "rules": { ".read": "auth != null", ".write": "auth != null" } }
   ```

---

## Step 5 — Create Firebase Storage

1. Sidebar → **Build → Storage → Get started**
2. **Start in production mode** → Next
3. Region: **asia-south1** → Done

---

## Step 6 — Get Your Web App Config

1. **Project Settings** (⚙️ gear icon) → **"Your apps"** tab
2. Click **"</ >"** Web icon → register app name: `winggo-web`
3. Leave "Firebase Hosting" **unchecked**
4. Copy the `firebaseConfig` object shown — you'll need these values next

---

## Step 7 — Update Replit Secrets ✅ THIS IS THE ONLY CODE STEP

Open the Replit **Secrets** panel (🔒 icon in left sidebar) and update/create
these 7 secrets with values from your new Firebase project:

| Secret Name                       | Where to find the value             |
|-----------------------------------|-------------------------------------|
| `VITE_FIREBASE_API_KEY`           | firebaseConfig → `apiKey`           |
| `VITE_FIREBASE_AUTH_DOMAIN`       | firebaseConfig → `authDomain`       |
| `VITE_FIREBASE_PROJECT_ID`        | firebaseConfig → `projectId`        |
| `VITE_FIREBASE_STORAGE_BUCKET`    | firebaseConfig → `storageBucket`    |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | firebaseConfig → `messagingSenderId` |
| `VITE_FIREBASE_APP_ID`            | firebaseConfig → `appId`            |
| `VITE_FIREBASE_DATABASE_URL`      | Realtime Database → Data tab → URL  |

After saving all secrets → **Restart both workflows** in Replit (winzo + api-server).

---

## Step 8 — Whitelist Your Replit Domain

1. Firebase Console → **Authentication → Settings → Authorized domains**
2. Click **"Add domain"** → paste your Replit dev URL
   - Format: `your-repl.your-username.replit.dev`
3. After publishing, also add your `.replit.app` domain

---

## Step 9 — Seed Firestore Collections

Collections are **auto-created** when users sign up and use the app.
No manual seeding needed. The `seedGamesIfEmpty()` function in the app
auto-populates the `games` collection on first Dashboard load.

Manual collections to create (optional, for admin panel preview):
- `users` · `wallets` · `transactions` · `games` · `kyc` · `withdrawals` · `referrals`

---

## Verification Checklist

- [ ] Phone Auth enabled in Firebase Console
- [ ] Firestore Database created (asia-south1)
- [ ] Realtime Database created with auth rules
- [ ] Storage bucket created
- [ ] All 7 Replit secrets updated with new project values
- [ ] Replit domain added to Firebase Authorized Domains
- [ ] Both workflows restarted in Replit
- [ ] Can sign in with OTP on the app
- [ ] Wallet balance syncs (check Firestore `wallets` collection)
- [ ] Admin panel connects (check Firestore `users` collection)
