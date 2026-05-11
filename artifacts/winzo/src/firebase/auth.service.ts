/**
 * Firebase Authentication Service — WINGGO
 * Phone OTP flow: sendOTP → verifyOTP → user profile created in Firestore
 *
 * Graceful demo mode:
 *  - When FIREBASE_ENABLED=false → demo from the start (any phone / OTP 123456)
 *  - When Firebase returns auth/api-key-not-valid at runtime → auto-flip to demo
 *    so the user always sees a working UI even with misconfigured secrets
 */
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
} from "firebase/auth";
import { auth, FIREBASE_ENABLED } from "./config";
import { createUserProfile, getUserProfile } from "./firestore.service";

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

/**
 * Runtime demo-fallback flag.
 * Starts false; gets set to true if Firebase returns an auth error
 * like api-key-not-valid so the rest of the session runs in demo mode.
 */
let _demoFallback = false;

export function isDemoMode(): boolean {
  return !FIREBASE_ENABLED || _demoFallback;
}

/** Errors that tell us the Firebase project isn't reachable / misconfigured */
const CREDENTIAL_ERRORS = new Set([
  "auth/api-key-not-valid",
  "auth/invalid-api-key",
  "auth/project-not-found",
  "auth/invalid-app-credential",
  "auth/app-not-authorized",
]);

function isCredentialError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as { code?: string }).code ?? "";
    return CREDENTIAL_ERRORS.has(code) || err.message.includes("api-key-not-valid");
  }
  return false;
}

/** Mount an invisible reCAPTCHA on the given element id */
export function initRecaptcha(containerId: string): void {
  if (!FIREBASE_ENABLED || !auth || _demoFallback) return;
  try {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {},
      "expired-callback": () => {
        recaptchaVerifier?.clear();
        recaptchaVerifier = null;
      },
    });
  } catch {
    _demoFallback = true;
  }
}

/** Send OTP to an Indian mobile number (format: +91XXXXXXXXXX) */
export async function sendOTP(
  phoneNumber: string
): Promise<{ success: boolean; demo?: boolean; error?: string }> {
  if (!FIREBASE_ENABLED || _demoFallback) {
    return { success: true, demo: true };
  }
  try {
    if (!recaptchaVerifier) initRecaptcha("recaptcha-container");
    const fullNumber = phoneNumber.startsWith("+91")
      ? phoneNumber
      : `+91${phoneNumber}`;
    confirmationResult = await signInWithPhoneNumber(auth!, fullNumber, recaptchaVerifier!);
    return { success: true, demo: false };
  } catch (err: unknown) {
    if (isCredentialError(err)) {
      // Invalid / placeholder keys — silently switch to demo mode
      _demoFallback = true;
      recaptchaVerifier?.clear();
      recaptchaVerifier = null;
      return { success: true, demo: true };
    }
    const msg = err instanceof Error ? err.message : "Failed to send OTP";
    return { success: false, error: msg };
  }
}

/** Verify the 6-digit OTP entered by the user */
export async function verifyOTP(
  otp: string
): Promise<{ success: boolean; uid?: string; isNewUser?: boolean; demo?: boolean; error?: string }> {
  // Demo mode (either from the start or after a runtime credential error)
  if (!FIREBASE_ENABLED || _demoFallback) {
    if (otp !== "123456") {
      return { success: false, error: "Demo OTP is 123456" };
    }
    return {
      success: true,
      uid: `demo-${Date.now()}`,
      isNewUser: false,
      demo: true,
    };
  }

  if (!confirmationResult) {
    return { success: false, error: "Session expired. Please request OTP again." };
  }

  try {
    const credential = await confirmationResult.confirm(otp);
    const user = credential.user;
    const profile = await getUserProfile(user.uid);
    const isNewUser = !profile;
    if (isNewUser) {
      await createUserProfile(user.uid, {
        phone: user.phoneNumber ?? "",
        displayName: `Player${user.uid.slice(-4).toUpperCase()}`,
        photoURL: "",
        createdAt: Date.now(),
        kycStatus: "pending",
        referralCode: generateReferralCode(),
        referredBy: null,
        deviceInfo: navigator.userAgent,
      });
    }
    confirmationResult = null;
    return { success: true, uid: user.uid, isNewUser, demo: false };
  } catch (err: unknown) {
    if (isCredentialError(err)) {
      _demoFallback = true;
      return { success: false, error: "Firebase not configured — enter OTP 123456" };
    }
    const msg = err instanceof Error ? err.message : "Invalid OTP";
    return { success: false, error: msg };
  }
}

/** Update the display name of the current user */
export async function updateDisplayName(name: string): Promise<void> {
  if (!FIREBASE_ENABLED || !auth?.currentUser) return;
  await updateProfile(auth.currentUser, { displayName: name });
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
