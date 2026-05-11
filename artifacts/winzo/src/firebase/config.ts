/**
 * Firebase Configuration for WINGGO
 * ------------------------------------
 * Reads credentials from VITE_ environment variables.
 * Falls back to "demo mode" when credentials are absent so the
 * app is still fully usable without a Firebase project.
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? "",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? "",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? "",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? "",
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       ?? "",
};

/** True when all required Firebase keys are present */
export const FIREBASE_ENABLED =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _rtdb: Database | null = null;
let _storage: FirebaseStorage | null = null;

if (FIREBASE_ENABLED) {
  app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

  _auth    = getAuth(app);
  _db      = getFirestore(app);
  _rtdb    = getDatabase(app);
  _storage = getStorage(app);
}

export const auth    = _auth;
export const db      = _db;
export const rtdb    = _rtdb;
export const storage = _storage;
export { app };
