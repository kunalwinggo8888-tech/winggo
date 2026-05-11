/**
 * Firebase Authentication Service — WINGGO
 * Phone OTP flow: sendOTP → verifyOTP → user profile created in Firestore
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

/** Mount an invisible reCAPTCHA on the given element id */
export function initRecaptcha(containerId: string): void {
  if (!FIREBASE_ENABLED || !auth) return;
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
}

/** Send OTP to an Indian mobile number (format: +91XXXXXXXXXX) */
export async function sendOTP(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
  if (!FIREBASE_ENABLED || !auth) {
    // Demo mode — any phone passes
    return { success: true };
  }
  try {
    if (!recaptchaVerifier) {
      initRecaptcha("recaptcha-container");
    }
    const fullNumber = phoneNumber.startsWith("+91") ? phoneNumber : `+91${phoneNumber}`;
    confirmationResult = await signInWithPhoneNumber(auth, fullNumber, recaptchaVerifier!);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send OTP";
    return { success: false, error: msg };
  }
}

/** Verify the 6-digit OTP entered by the user */
export async function verifyOTP(otp: string): Promise<{ success: boolean; uid?: string; isNewUser?: boolean; error?: string }> {
  if (!FIREBASE_ENABLED || !auth) {
    // Demo mode
    return { success: true, uid: "demo-uid-" + Date.now(), isNewUser: false };
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
    return { success: true, uid: user.uid, isNewUser };
  } catch (err: unknown) {
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
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
