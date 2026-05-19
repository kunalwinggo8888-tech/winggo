/**
 * WINGGO Admin — Emergency Account Recovery Service
 *
 * Security model:
 *  - VITE_ADMIN_MASTER_KEY_HASH : SHA-256 of the master recovery key (set in Replit secrets)
 *  - VITE_ADMIN_BACKUP_EMAIL    : Backup Gmail address (set in Replit secrets)
 *  - Firebase Auth email link   : Proves backup Gmail inbox ownership
 *  - system/admin_config        : Firestore override written after successful 2-factor verification
 *
 * Setup checklist (do once, BEFORE you ever need recovery):
 *  1. Choose a strong master key, e.g. "WINGGO-MASTER-RECOVER-2026-ABC123XYZ"
 *  2. Compute SHA-256: https://emn178.github.io/online-tools/sha256.html
 *  3. Add VITE_ADMIN_MASTER_KEY_HASH = <that hash>  in Replit Secrets
 *  4. Add VITE_ADMIN_BACKUP_EMAIL    = <your backup gmail> in Replit Secrets
 *  5. In Firebase Console → Authentication → Settings → Authorized domains
 *     add your Replit app domain (e.g. yourproject.replit.app)
 */

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { adminAuth, adminDb, FIREBASE_ENABLED } from "./config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

const RECOVERY_EMAIL_KEY = "winggo_recovery_email_pending";

// ─── Config accessors (from env vars — baked in at build, NOT in Firestore) ──

export function getMasterKeyHash(): string {
  return import.meta.env.VITE_ADMIN_MASTER_KEY_HASH ?? "";
}

export function getBackupEmail(): string {
  return import.meta.env.VITE_ADMIN_BACKUP_EMAIL ?? "";
}

export function isRecoveryConfigured(): boolean {
  return Boolean(getMasterKeyHash()) && Boolean(getBackupEmail());
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "•••@•••.com";
  const [user, domain] = email.split("@");
  const masked =
    user.length <= 3
      ? "•".repeat(user.length)
      : user.slice(0, 2) + "•".repeat(Math.min(user.length - 3, 5)) + user.slice(-1);
  return `${masked}@${domain}`;
}

// ─── Step 1: Validate master key ──────────────────────────────────────────────

export async function validateMasterKey(
  inputKey: string,
): Promise<{ valid: boolean; error?: string }> {
  const expected = getMasterKeyHash();
  if (!expected) {
    return {
      valid: false,
      error:
        "Recovery not configured. Add VITE_ADMIN_MASTER_KEY_HASH to Replit Secrets.",
    };
  }
  if (!getBackupEmail()) {
    return {
      valid: false,
      error:
        "Backup email not configured. Add VITE_ADMIN_BACKUP_EMAIL to Replit Secrets.",
    };
  }
  const inputHash = await sha256(inputKey.trim());
  if (inputHash !== expected) {
    return { valid: false, error: "Invalid master recovery key." };
  }
  return { valid: true };
}

// ─── Step 2a: Send Firebase sign-in link to backup Gmail ─────────────────────

export async function sendRecoveryEmailLink(): Promise<{
  sent: boolean;
  email: string;
  error?: string;
}> {
  if (!FIREBASE_ENABLED || !adminAuth) {
    return { sent: false, email: "", error: "Firebase is not configured." };
  }
  const email = getBackupEmail();
  if (!email) {
    return { sent: false, email: "", error: "Backup email not configured." };
  }

  const baseUrl = window.location.href.split("?")[0].split("#")[0];
  const actionCodeSettings = {
    url: `${baseUrl}?recovery_verify=1`,
    handleCodeInApp: true,
  };

  try {
    await sendSignInLinkToEmail(adminAuth, email, actionCodeSettings);
    sessionStorage.setItem(RECOVERY_EMAIL_KEY, email);
    return { sent: true, email };
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : "Failed to send verification link. Check Firebase authorized domains.";
    return { sent: false, email, error: msg };
  }
}

// ─── Step 2b: Detect & complete email link verification on page reload ────────

export function isRecoveryEmailLink(): boolean {
  if (!FIREBASE_ENABLED || !adminAuth) return false;
  return isSignInWithEmailLink(adminAuth, window.location.href);
}

export async function completeEmailVerification(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!FIREBASE_ENABLED || !adminAuth) {
    return { success: false, error: "Firebase is not configured." };
  }

  const email =
    sessionStorage.getItem(RECOVERY_EMAIL_KEY) ?? getBackupEmail();
  if (!email) {
    return {
      success: false,
      error: "Could not determine backup email for verification.",
    };
  }

  try {
    await signInWithEmailLink(adminAuth, email, window.location.href);
    sessionStorage.removeItem(RECOVERY_EMAIL_KEY);

    // Clean recovery params from URL without reloading
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, clean);

    return { success: true };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Email link verification failed.";
    return { success: false, error: msg };
  }
}

// ─── Step 3: Write new admin credentials to Firestore override ────────────────

export async function applyNewAdminCredentials(
  newAdminId: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!FIREBASE_ENABLED || !adminDb) {
    return { success: false, error: "Firebase is not configured." };
  }
  if (!newAdminId.trim() || !newPassword) {
    return { success: false, error: "Admin ID and password are required." };
  }
  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  try {
    const passwordHash = await sha256(newPassword);
    await setDoc(doc(adminDb, "system/admin_config"), {
      adminId:      newAdminId.trim(),
      passwordHash,
      recoveredAt:  serverTimestamp(),
      version:      2,                 // sentinel so auth override is active
    });

    // Sign out of Firebase Auth — admin panel uses its own session system
    if (adminAuth) {
      try { await signOut(adminAuth); } catch { /* ignore */ }
    }

    return { success: true };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Failed to save new credentials.";
    return { success: false, error: msg };
  }
}
