/**
 * Firebase Configuration — WINGGO Admin Panel
 * Also exports StaffPermissions (shared type used by admin.service + StaffDashboard)
 */

// ─── Staff Permissions (shared type) ─────────────────────────────────────────

export interface StaffPermissions {
  users:         boolean;
  deposits:      boolean;
  withdrawals:   boolean;
  kyc:           boolean;
  games:         boolean;
  marketing:     boolean;
  notifications: boolean;
  referral:      boolean;
}

export const ALL_PERMS: (keyof StaffPermissions)[] = [
  "users","deposits","withdrawals","kyc","games","marketing","notifications","referral",
];

// ─── Staff Session ────────────────────────────────────────────────────────────

const STAFF_SESSION_KEY = "winggo_staff_session_v1";
const STAFF_SESSION_TTL = 24 * 60 * 60 * 1000;

export interface StaffSessionData {
  id:          string;
  username:    string;
  permissions: StaffPermissions;
  expiresAt:   number;
}

export function saveStaffSession(id: string, username: string, permissions: StaffPermissions): void {
  const data: StaffSessionData = { id, username, permissions, expiresAt: Date.now() + STAFF_SESSION_TTL };
  sessionStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(data));
}

export function getStaffSession(): StaffSessionData | null {
  try {
    const raw = sessionStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    const data: StaffSessionData = JSON.parse(raw);
    if (Date.now() > data.expiresAt) { sessionStorage.removeItem(STAFF_SESSION_KEY); return null; }
    return data;
  } catch { return null; }
}

export function hasStaffSession(): boolean { return Boolean(getStaffSession()); }
export function clearStaffSession(): void { sessionStorage.removeItem(STAFF_SESSION_KEY); }

/**
 * Firebase Configuration — WINGGO Admin Panel (continued below)
 * Reads from the same VITE_FIREBASE_* env vars as the main app.
 *
 * Admin Authentication:
 *  - Uses VITE_ADMIN_ID and VITE_ADMIN_PASSWORD_HASH env vars (set in Replit secrets)
 *  - Password is compared against a SHA-256 hash stored in env (never stored plaintext)
 *  - Session is stored in sessionStorage with a 24-hour expiry
 *  - Falls back to demo mode when Firebase is not configured
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, doc, getDoc } from "firebase/firestore";
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

/** Export session saver so recovery flow can create a session after restoring creds */
export function saveAdminSession(token: string): void { saveSession(token); }

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
 * Read the Firestore credential override written by the recovery system.
 * Returns null if no override exists or Firebase is unavailable.
 */
async function getAdminConfigOverride(): Promise<{
  adminId: string;
  passwordHash: string;
} | null> {
  if (!FIREBASE_ENABLED || !_db) return null;
  try {
    const snap = await getDoc(doc(_db, "system/admin_config"));
    if (!snap.exists()) return null;
    const data = snap.data() as {
      adminId?: string;
      passwordHash?: string;
      version?: number;
    };
    // version:2 sentinel confirms this is a recovery-written override
    if (data.version === 2 && data.adminId && data.passwordHash) {
      return { adminId: data.adminId, passwordHash: data.passwordHash };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate admin credentials.
 *
 * Priority order:
 *  1. Firestore override (system/admin_config) — written by the emergency
 *     recovery flow. Lets recovered credentials work without rebuilding.
 *  2. Env vars VITE_ADMIN_ID + VITE_ADMIN_PASSWORD_HASH — normal login path.
 *  3. Hardcoded demo fallback — only when both env vars are absent.
 */
export async function adminSignIn(
  adminId: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  if (!adminId.trim() || !password) {
    return { success: false, error: "Enter your Admin ID and password." };
  }

  try {
    // ── Priority 1: Check Firestore recovery override ─────────────────────
    const override = await getAdminConfigOverride();
    if (override) {
      const enteredHash = await sha256(password);
      if (
        adminId.trim() === override.adminId &&
        enteredHash     === override.passwordHash
      ) {
        const token = await generateSessionToken(adminId, enteredHash);
        saveSession(token);
        return { success: true };
      }
      // Override exists but creds don't match → fall through to env vars
    }

    // ── Priority 2: Env var credentials ──────────────────────────────────
    const expectedId       = import.meta.env.VITE_ADMIN_ID            ?? "";
    const expectedPassHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH ?? "";
    const useFallback      = !expectedId || !expectedPassHash;

    if (!useFallback) {
      if (adminId.trim() !== expectedId.trim()) {
        return { success: false, error: "❌ Invalid Admin ID or password." };
      }
      const enteredHash = await sha256(password);
      if (enteredHash !== expectedPassHash) {
        return { success: false, error: "❌ Invalid Admin ID or password." };
      }
      const token = await generateSessionToken(adminId, enteredHash);
      saveSession(token);
      return { success: true };
    }

    // ── Priority 3: Demo fallback (env vars absent) ───────────────────────
    if (adminId === "kunalwinggo" && password === "winggokunal") {
      const token = await generateSessionToken(adminId, "demo");
      saveSession(token);
      return { success: true };
    }
    return { success: false, error: "❌ Invalid Admin ID or password." };

  } catch {
    return { success: false, error: "Authentication error. Please try again." };
  }
}
