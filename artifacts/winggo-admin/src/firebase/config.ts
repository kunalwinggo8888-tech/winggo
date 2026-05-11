/**
 * Firebase Configuration — WINGGO Admin Panel
 * Reads from the same VITE_FIREBASE_* env vars as the main app.
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth, signInWithEmailAndPassword } from "firebase/auth";
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

export const FIREBASE_ENABLED =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

if (FIREBASE_ENABLED) {
  app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];
  _auth    = getAuth(app);
  _db      = getFirestore(app);
  _storage = getStorage(app);
}

export const adminAuth    = _auth;
export const adminDb      = _db;
export const adminStorage = _storage;
export { app };

/** Admin email/password login (separate from player phone auth) */
export async function adminSignIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  if (!FIREBASE_ENABLED || !_auth) {
    if (email === "admin@winggo.in" && password === "winggo@2024") return { success: true };
    return { success: false, error: "Invalid credentials" };
  }
  try {
    await signInWithEmailAndPassword(_auth, email, password);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Login failed" };
  }
}
