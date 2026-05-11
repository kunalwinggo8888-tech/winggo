/**
 * Firebase Configuration for WINGGO
 * ------------------------------------
 * Reads credentials from VITE_ environment variables.
 * Falls back to "demo mode" when credentials are absent OR invalid so the
 * app is still fully usable without a Firebase project.
 *
 * TRANSPORT NOTE:
 * Replit's reverse proxy blocks WebSocket/gRPC — the default Firestore
 * transport. We use initializeFirestore() with experimentalForceLongPolling
 * to switch to HTTP long-polling, which works reliably through the proxy.
 *
 * RE-INIT GUARD:
 * initializeFirestore throws failed-precondition if called on an app that
 * already has a Firestore instance (e.g. Vite HMR). We catch that and fall
 * back to getFirestore() which returns the already-configured instance.
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import {
  initializeFirestore, getFirestore, Firestore,
} from "firebase/firestore";
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

  /**
   * Force HTTP long-polling instead of WebSocket/gRPC.
   * This is the fix for "client is offline" errors in proxied environments
   * (Replit, corporate networks, etc.) where WebSocket upgrades are blocked.
   *
   * initializeFirestore throws `failed-precondition` if called more than once
   * on the same app (e.g. Vite HMR). We catch that and use getFirestore()
   * which returns the already-configured instance with long-polling intact.
   */
  try {
    _db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch {
    _db = getFirestore(app);
  }

  _storage = getStorage(app);

  if (firebaseConfig.databaseURL) {
    try {
      _rtdb = getDatabase(app);
    } catch {
      _rtdb = null;
    }
  }
}

export const auth    = _auth;
export const db      = _db;
export const rtdb    = _rtdb;
export const storage = _storage;
export { app };
