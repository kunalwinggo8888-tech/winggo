/**
 * Firebase Authentication Service — WINGGO
 *
 * Providers:
 *  Email / Password : signInWithEmail, signUpWithEmail, resetPassword
 *  Google           : signInWithGoogle   (GoogleAuthProvider + signInWithPopup)
 *  Facebook         : signInWithFacebook (FacebookAuthProvider + signInWithPopup)
 *
 * PERFORMANCE NOTE:
 * We intentionally do NOT await Firestore calls inside auth functions.
 * Blocking on Firestore with long-polling causes 5-12 second delays before the
 * dashboard appears. Instead we return as soon as Firebase Auth resolves and let
 * AuthContext hydrate the Firestore profile in the background.
 *
 * Demo mode:
 *  - FIREBASE_ENABLED=false  → demo (any email / password "demo1234")
 *  - Runtime credential error → auto-flip to demo (_demoFallback)
 *
 * Facebook setup requirements:
 *  - Enable Facebook sign-in in Firebase Console → Authentication → Sign-in method
 *  - Add your Facebook App ID + Secret
 *  - Add the Firebase OAuth callback URL to your Facebook App's allowed redirect URIs
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile as fbUpdateProfile,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, FIREBASE_ENABLED } from "./config";
import { createUserProfile, initWallet } from "./firestore.service";

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

// ─── Email / Password ─────────────────────────────────────────────────────────

/** Sign up with name + email + password */
export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  if (isDemoMode()) {
    return { success: true, uid: `demo-${Date.now()}`, isNewUser: true, demo: true };
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth!, email, password);
    await fbUpdateProfile(cred.user, { displayName: name });

    // Fire-and-forget: does NOT block the login response.
    createUserProfile(cred.user.uid, {
      email,
      displayName: name,
      photoURL: "",
      createdAt: Date.now(),
      kycStatus: "pending",
      referralCode: generateReferralCode(),
      referredBy: null,
      deviceInfo: navigator.userAgent,
    }).catch(() => {});

    return { success: true, uid: cred.user.uid, isNewUser: true, demo: false };
  } catch (err: unknown) {
    if (isCredentialError(err)) {
      _demoFallback = true;
      return { success: true, uid: `demo-${Date.now()}`, isNewUser: true, demo: true };
    }
    return { success: false, error: friendlyError(err) };
  }
}

/** Sign in with email + password */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (isDemoMode()) {
    if (password !== "demo1234") {
      return { success: false, error: 'Demo mode — use password "demo1234"' };
    }
    return { success: true, uid: `demo-${Date.now()}`, isNewUser: false, demo: true };
  }
  try {
    const cred = await signInWithEmailAndPassword(auth!, email, password);
    return { success: true, uid: cred.user.uid, isNewUser: false, demo: false };
  } catch (err: unknown) {
    if (isCredentialError(err)) {
      _demoFallback = true;
      return { success: false, error: 'Demo mode active — password is "demo1234"' };
    }
    return { success: false, error: friendlyError(err) };
  }
}

/** Send password reset email */
export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) return { success: true };
  try {
    await sendPasswordResetEmail(auth!, email);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: friendlyError(err) };
  }
}

// ─── Social Login ─────────────────────────────────────────────────────────────

/** Google Sign-In via popup */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (isDemoMode()) {
    return { success: true, uid: `demo-google-${Date.now()}`, isNewUser: false, demo: true };
  }
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    const cred        = await signInWithPopup(auth!, provider);
    const extra       = getAdditionalUserInfo(cred);
    const isNewUser   = extra?.isNewUser ?? false;

    // Fire-and-forget Firestore upsert — name + photo from Google account
    upsertSocialProfile(cred.user, isNewUser).catch(() => {});

    return { success: true, uid: cred.user.uid, isNewUser, demo: false };
  } catch (err: unknown) {
    if (isCredentialError(err)) {
      _demoFallback = true;
      return { success: true, uid: `demo-google-${Date.now()}`, demo: true };
    }
    const code = (err as { code?: string }).code ?? "";
    // Silent cancel — user closed the popup themselves
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { success: false, error: "" };
    }
    return { success: false, error: friendlyError(err) };
  }
}

/** Facebook Sign-In via popup */
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
