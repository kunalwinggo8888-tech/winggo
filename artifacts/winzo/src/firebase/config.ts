/**
 * Firebase Configuration for WINGGO
 * ------------------------------------
 * Reads credentials from VITE_ environment variables.
 * Falls back to "demo mode" when credentials are absent OR invalid so the
 * app is still fully usable without a Firebase project.
 *
 * Firebase Web API keys always start with "AIza" — we use this as a
 * quick validity check before attempting to initialise Firebase, which
 * prevents the red `auth/api-key-not-valid` console error when the
 * secrets are set to placeholder values.
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";
import { getStorage, FirebaseStorage } from "firebase/storage";

/** Strip any child path from the RTDB URL — Firebase requires the root only */
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

/**
 * Firebase Web API keys always begin with "AIza".
 * If the stored key doesn't match, we know it's a placeholder/invalid value
 * and we skip initialisation entirely — falling back to demo mode.
 */
const VALID_API_KEY_FORMAT = /^AIza[0-9A-Za-z_-]{35,}$/.test(firebaseConfig.apiKey);

/** True only when all required Firebase keys are present AND look valid */
export const FIREBASE_ENABLED =
  VALID_API_KEY_FORMAT &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _rtdb: Database | null = null;
let _storage: FirebaseStorage | null = null;

if (FIREBASE_ENABLED) {
  app      = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  _auth    = getAuth(app);
  _db      = getFirestore(app);
  _storage = getStorage(app);
  if (firebaseConfig.databaseURL) {
    _rtdb = getDatabase(app);
  }
}

export const auth    = _auth;
export const db      = _db;
export const rtdb    = _rtdb;
export const storage = _storage;
export { app };
