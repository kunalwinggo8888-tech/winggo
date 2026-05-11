/**
 * Firebase Authentication Service — WINGGO
 * Email / Password flow:
 *  signUpWithEmail → createUserWithEmailAndPassword → Firestore profile (fire-and-forget)
 *  signInWithEmail → signInWithEmailAndPassword (no Firestore block)
 *  resetPassword   → sendPasswordResetEmail
 *
 * PERFORMANCE NOTE:
 * We intentionally do NOT await Firestore calls (getUserProfile / createUserProfile)
 * inside auth functions. Blocking on Firestore with long-polling causes 5-12 second
 * delays before the dashboard appears. Instead we return as soon as Firebase Auth
 * resolves and let AuthContext hydrate the Firestore profile in the background.
 *
 * Demo mode:
 *  - FIREBASE_ENABLED=false → demo (any email / password "demo1234")
 *  - Runtime credential error → auto-flip to demo (_demoFallback)
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile as fbUpdateProfile,
} from "firebase/auth";
import { auth, FIREBASE_ENABLED } from "./config";
import { createUserProfile } from "./firestore.service";

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
    case "auth/invalid-credential":     return "Invalid email or password.";
    case "auth/wrong-password":         return "Incorrect password. Try again.";
    case "auth/email-already-in-use":   return "Email already registered. Please log in.";
    case "auth/weak-password":          return "Password must be at least 6 characters.";
    case "auth/invalid-email":          return "Enter a valid email address.";
    case "auth/too-many-requests":      return "Too many attempts. Please wait and try again.";
    case "auth/network-request-failed": return "Network error. Check your connection.";
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

    // Fire-and-forget: Firestore profile creation does NOT block the login response.
    // AuthContext.onAuthChange will pick up the user immediately from Firebase Auth
    // and the profile subscription will hydrate once Firestore responds.
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
    // Only block on Firebase Auth (fast: ~1s). Do NOT await Firestore.
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
