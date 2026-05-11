/**
 * Firebase Configuration — WINGGO Admin Panel
 * Reads from the same VITE_FIREBASE_* env vars as the main app.
 *
 * Admin Authentication:
 *  - Uses VITE_ADMIN_ID and VITE_ADMIN_PASSWORD_HASH env vars (set in Replit secrets)
 *  - Password is compared against a SHA-256 hash stored in env (never stored plaintext)
 *  - Session is stored in sessionStorage with a 24-hour expiry
 *  - Falls back to demo mode when Firebase is not configured
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getDatabase, Database } from "firebase/database";

/** Strip any child path — Firebase RTDB requires the root URL only */
function sanitizeDbUrl(raw: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             ?? "",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         ?? "",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          ?? "",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              ?? "",
  databaseURL:       sanitizeDbUrl(import.meta.env.VITE_FIREBASE_DATABASE_URL ?? ""),
};

export const FIREBASE_ENABLED =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _rtdb: Database | null = null;

if (FIREBASE_ENABLED) {
  app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];
  _auth    = getAuth(app);
  _db      = getFirestore(app);
  _storage = getStorage(app);
  if (firebaseConfig.databaseURL) {
    _rtdb = getDatabase(app);
  }
}

export const adminAuth    = _auth;
export const adminDb      = _db;
export const adminStorage = _storage;
export const adminRtdb    = _rtdb;
export { app };

// ─── Admin Session ────────────────────────────────────────────────────────────

const SESSION_KEY   = "winggo_admin_session_v2";
const SESSION_TTL   = 24 * 60 * 60 * 1000; // 24 hours in ms

interface AdminSession {
  token: string;
  expiresAt: number;
}

/** Compute SHA-256 hash of a string using the Web Crypto API */
async function sha256(input: string): Promise<string> {
  const encoded  = new TextEncoder().encode(input);
  const hashBuf  = await crypto.subtle.digest("SHA-256", encoded);
  const hashArr  = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a one-time session token from credentials + timestamp */
async function generateSessionToken(adminId: string, passwordHash: string): Promise<string> {
  const payload = `${adminId}:${passwordHash}:${Math.floor(Date.now() / SESSION_TTL)}`;
  return sha256(payload);
}

/** Save session to sessionStorage (cleared when browser tab closes) */
function saveSession(token: string): void {
  const session: AdminSession = { token, expiresAt: Date.now() + SESSION_TTL };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/** Load and validate session from sessionStorage */
function loadSession(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AdminSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session.token;
  } catch {
    return null;
  }
}

/** Check if there is a valid active admin session */
export function hasAdminSession(): boolean {
  return Boolean(loadSession());
}

/** Clear the admin session (logout) */
export function clearAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Validate admin credentials.
 * Compares the provided username against VITE_ADMIN_ID and the
 * SHA-256 hash of the provided password against VITE_ADMIN_PASSWORD_HASH.
 * Both values are set as environment variables and never stored in code.
 */
export async function adminSignIn(
  adminId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  if (!adminId.trim() || !password) {
    return { success: false, error: "Enter your Admin ID and password." };
  }

  // Read expected credentials from env vars (set via Replit secrets/env)
  const expectedId       = import.meta.env.VITE_ADMIN_ID           ?? "";
  const expectedPassHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH ?? "";

  // Fallback for when env vars aren't set (dev/demo mode)
  const useFallback = !expectedId || !expectedPassHash;

  try {
    if (useFallback) {
      // Demo fallback — only if env vars are missing
      if (adminId === "kunalwinggo" && password === "winggokunal") {
        const token = await generateSessionToken(adminId, "demo");
        saveSession(token);
        return { success: true };
      }
      return { success: false, error: "❌ Invalid Admin ID or password." };
    }

    // ID check (case-sensitive)
    if (adminId.trim() !== expectedId.trim()) {
      return { success: false, error: "❌ Invalid Admin ID or password." };
    }

    // Hash the entered password and compare
    const enteredHash = await sha256(password);
    if (enteredHash !== expectedPassHash) {
      return { success: false, error: "❌ Invalid Admin ID or password." };
    }

    // Generate and persist session token
    const token = await generateSessionToken(adminId, enteredHash);
    saveSession(token);
    return { success: true };

  } catch {
    return { success: false, error: "Authentication error. Please try again." };
  }
}
