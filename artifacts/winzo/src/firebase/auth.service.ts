/**
 * Firebase Authentication Service — WINGGO
 *
 * Providers:
 *  Facebook         : signInWithFacebook (FacebookAuthProvider + signInWithPopup)
 *                     — the ONLY social login in the app.
 *  One-time linking : linkOldAccountGoogle / linkOldAccountPassword
 *                     Only used when a returning user's email already exists
 *                     under a different provider (auth/account-exists-with-
 *                     different-credential). Links the Facebook credential to
 *                     their EXISTING Firebase account so the UID never changes
 *                     and all Firestore data (wallet, KYC, referral, games)
 *                     stays intact. Google/email sign-in is never shown in the
 *                     normal UI.
 *
 * PERFORMANCE NOTE:
 * We intentionally do NOT await Firestore calls inside auth functions.
 * Blocking on Firestore with long-polling causes 5-12 second delays before the
 * dashboard appears. Instead we return as soon as Firebase Auth resolves and let
 * AuthContext hydrate the Firestore profile in the background.
 *
 * Demo mode:
 *  - FIREBASE_ENABLED=false  → demo login via the Facebook button
 *  - Runtime credential error → auto-flip to demo (_demoFallback)
 *
 * Facebook setup requirements:
 *  - Enable Facebook sign-in in Firebase Console → Authentication → Sign-in method
 *  - Add your Facebook App ID + Secret
 *  - Add the Firebase OAuth callback URL to your Facebook App's allowed redirect URIs
 */
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile as fbUpdateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  AuthCredential,
  AuthError,
  signInWithPopup,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, FIREBASE_ENABLED } from "./config";
import { initWallet } from "./firestore.service";

let _demoFallback = false;

export function isDemoMode(): boolean {
  return !FIREBASE_ENABLED || _demoFallback;
}

const CREDENTIAL_ERRORS = new Set([
  "auth/api-key-not-valid",
  "auth/invalid-api-key",
  "auth/project-not-found",
  "auth/invalid-app-credential",
  "auth/app-not-authorized",
]);

function isCredentialError(err: unknown): boolean {
  const code = (err as { code?: string }).code ?? "";
  return CREDENTIAL_ERRORS.has(code) ||
    (err instanceof Error && err.message.includes("api-key-not-valid"));
}

function friendlyError(err: unknown): string {
  const code = (err as { code?: string }).code ?? "";
  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":               return "Invalid email or password.";
    case "auth/wrong-password":                   return "Incorrect password. Try again.";
    case "auth/email-already-in-use":             return "Email already registered. Please log in.";
    case "auth/weak-password":                    return "Password must be at least 6 characters.";
    case "auth/invalid-email":                    return "Enter a valid email address.";
    case "auth/too-many-requests":                return "Too many attempts. Please wait and try again.";
    case "auth/network-request-failed":           return "Network error. Check your connection.";
    case "auth/operation-not-allowed":            return "This sign-in method is not enabled. Enable it in Firebase Console.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email. Try a different sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for login. Add it in Firebase Console → Authentication → Settings.";
    case "auth/popup-blocked":                    return "Popup blocked by browser. Please allow popups for this site.";
    default:
      return err instanceof Error ? err.message : "Something went wrong. Try again.";
  }
}

export type AuthResult = {
  success: boolean;
  uid?: string;
  isNewUser?: boolean;
  demo?: boolean;
  error?: string;
  /**
   * Set ONLY for Facebook logins whose email already belongs to an existing
   * Firebase account (auth/account-exists-with-different-credential).
   * LoginScreen shows a one-time "protect your old account" flow:
   * link the Facebook credential to the existing account instead of creating
   * a duplicate. The AuthCredential object is kept in React state (no
   * serialization needed).
   */
  link?: {
    email: string;
    methods: string[];
    fbCred: AuthCredential;
  };
};

// ─── Firestore profile upsert after social login ─────────────────────────────

async function upsertSocialProfile(user: User, isNewUser: boolean): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const baseFields = {
    displayName:  user.displayName ?? "",
    photoURL:     user.photoURL    ?? "",
    lastLoginAt:  Date.now(),
    email:        user.email       ?? "",
  };
  if (isNewUser) {
    // Full profile for brand-new social accounts
    await setDoc(doc(db, "users", user.uid), {
      ...baseFields,
      createdAt:          Date.now(),
      kycStatus:          "pending",
      referralCode:       generateReferralCode(),
      referredBy:         null,
      deviceInfo:         navigator.userAgent,
      signupBonusClaimed: true,
    }, { merge: true });
    // Initialize wallet — ₹25 signup bonus goes to wallet.bonus ONLY (deposit = 0)
    // initWallet is idempotent: if wallet already exists it does nothing.
    initWallet(user.uid).catch(() => {});
  } else {
    // Only refresh the fields the social provider owns for returning users
    await setDoc(doc(db, "users", user.uid), baseFields, { merge: true });
  }
}

// ─── Facebook-only authentication ─────────────────────────────────────────────
// Email/password login & signup were removed — the app is Facebook-only.
// (signInWithEmailAndPassword is still used by linkOldAccountPassword below.)

// ─── Social Login ─────────────────────────────────────────────────────────────

/**
 * Facebook Sign-In via popup — the app's ONLY login / signup method.
 *
 * PROFILE SYNC (required behaviour):
 *  Firebase populates displayName + photoURL from the Facebook public_profile
 *  automatically. upsertSocialProfile() then saves those into the user's
 *  Firestore profile doc, so the Winggo Profile/Dashboard show the same name
 *  and picture on every login without any manual upload.
 *
 * EXISTING ACCOUNTS:
 *  If the Facebook email matches an existing Firebase account created with a
 *  different provider, we do NOT create a duplicate. We return the pending
 *  credential + sign-in methods so LoginScreen can run the one-time "link your
 *  old account" flow (see linkOldAccountGoogle / linkOldAccountPassword).
 *  Linking preserves the original UID — wallet, KYC, referral and game data
 *  all stay exactly where they are.
 */
export async function signInWithFacebook(): Promise<AuthResult> {
  if (isDemoMode()) {
    return { success: true, uid: `demo-fb-${Date.now()}`, isNewUser: false, demo: true };
  }
  try {
    const provider  = new FacebookAuthProvider();
    provider.addScope("email");
    provider.addScope("public_profile");
    const cred      = await signInWithPopup(auth!, provider);
    const extra     = getAdditionalUserInfo(cred);
    const isNewUser = extra?.isNewUser ?? false;

    upsertSocialProfile(cred.user, isNewUser).catch(() => {});

    return { success: true, uid: cred.user.uid, isNewUser, demo: false };
  } catch (err: unknown) {
    if (isCredentialError(err)) {
      _demoFallback = true;
      return { success: true, uid: `demo-fb-${Date.now()}`, demo: true };
    }
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { success: false, error: "" };
    }
    // Email already registered with a different provider → offer one-time linking
    if (code === "auth/account-exists-with-different-credential") {
      const fbCred = FacebookAuthProvider.credentialFromError(err as AuthError);
      const email  = ((err as AuthError).customData?.email as string) || "";
      if (fbCred && email) {
        const methods = await fetchSignInMethodsForEmail(auth!, email).catch(() => [] as string[]);
        // Never create a duplicate account for an existing user
        return { success: false, error: "", link: { email, methods, fbCred } };
      }
    }
    return { success: false, error: friendlyError(err) };
  }
}

// ─── One-time old-account linking (edge case, never shown in normal UI) ──────

/**
 * Sign in to the user's EXISTING Google-backed Firebase account and link the
 * pending Facebook credential to it. The UID does not change, so every piece
 * of Firestore data (users doc, wallet, KYC, referral, matches) is preserved.
 */
export async function linkOldAccountGoogle(fbCred: AuthCredential): Promise<AuthResult> {
  if (isDemoMode()) {
    return { success: true, uid: `demo-fb-${Date.now()}`, isNewUser: false, demo: true };
  }
  try {
    const gProvider = new GoogleAuthProvider();
    gProvider.addScope("email");
    gProvider.addScope("profile");
    const res = await signInWithPopup(auth!, gProvider);
    try {
      await linkWithCredential(res.user, fbCred);
    } catch (linkErr: unknown) {
      // "credential-already-in-use" / "provider-already-linked" → Facebook is
      // already attached to this account, which is exactly what we wanted.
      const lcode = (linkErr as { code?: string }).code ?? "";
      if (lcode !== "auth/credential-already-in-use" && lcode !== "auth/provider-already-linked") {
        throw linkErr;
      }
    }
    // Sync the (possibly new) Facebook name/photo into the existing profile
    upsertSocialProfile(res.user, false).catch(() => {});
    return { success: true, uid: res.user.uid, isNewUser: false, demo: false };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { success: false, error: "" };
    }
    return { success: false, error: friendlyError(err) };
  }
}

/**
 * Sign in to the user's EXISTING email/password Firebase account and link the
 * pending Facebook credential to it (same UID → same data).
 */
export async function linkOldAccountPassword(
  email: string,
  password: string,
  fbCred: AuthCredential,
): Promise<AuthResult> {
  if (isDemoMode()) {
    return { success: true, uid: `demo-fb-${Date.now()}`, isNewUser: false, demo: true };
  }
  try {
    const cred = await signInWithEmailAndPassword(auth!, email, password);
    try {
      await linkWithCredential(cred.user, fbCred);
    } catch (linkErr: unknown) {
      const lcode = (linkErr as { code?: string }).code ?? "";
      if (lcode !== "auth/credential-already-in-use" && lcode !== "auth/provider-already-linked") {
        throw linkErr;
      }
    }
    upsertSocialProfile(cred.user, false).catch(() => {});
    return { success: true, uid: cred.user.uid, isNewUser: false, demo: false };
  } catch (err: unknown) {
    return { success: false, error: friendlyError(err) };
  }
}

// ─── Profile / Auth utilities ─────────────────────────────────────────────────

/** Update display name of current user */
export async function updateDisplayName(name: string): Promise<void> {
  if (!FIREBASE_ENABLED || !auth?.currentUser) return;
  await fbUpdateProfile(auth.currentUser, { displayName: name });
}

/** Sign out */
export async function logoutUser(): Promise<void> {
  if (!FIREBASE_ENABLED || !auth) return;
  await signOut(auth);
}

/** Subscribe to auth state changes */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  if (!FIREBASE_ENABLED || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
