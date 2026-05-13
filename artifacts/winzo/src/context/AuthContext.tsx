/**
 * Auth Context — WINGGO
 * Wraps Firebase email/password auth state and exposes user info to the whole app.
 * Works in demo mode when Firebase is not configured.
 *
 * PERFORMANCE:
 * - onAuthChange fires → user set IMMEDIATELY from Firebase Auth data (no Firestore wait)
 * - loading=false is set before Firestore responds → dashboard shows instantly
 * - Firestore profile hydrates in the background via subscribeUserProfile
 * - login() is now sync (sets user from Firebase Auth currentUser, no Firestore await)
 *
 * NOTE: useAuth hook lives in ./useAuth.ts (separate file) so Vite Fast Refresh
 * can HMR this provider without the "incompatible exports" cascade.
 */
import {
  createContext, useState, useEffect,
  useCallback, ReactNode,
} from "react";
import { User } from "firebase/auth";
import { auth, FIREBASE_ENABLED } from "@/firebase/config";
import { onAuthChange, logoutUser, isDemoMode } from "@/firebase/auth.service";
import {
  getUserProfile, subscribeUserProfile,
  UserProfile, updateUserProfile, ensureUserProfile,
} from "@/firebase/firestore.service";
import { goOnline } from "@/firebase/rtdb.service";
import { requestNotificationPermission } from "@/firebase/messaging.service";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  kycStatus: "pending" | "submitted" | "approved" | "rejected";
  referralCode: string;
  isDemo: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (uid: string, email: string, isNewUser?: boolean) => void;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Pick<AuthUser, "displayName" | "photoURL">>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── DEMO USER ────────────────────────────────────────────────────────────────

function buildDemoUser(email = ""): AuthUser {
  return {
    uid:          "demo-user-001",
    email:        email || "demo@winggo.app",
    displayName:  "Demo Player",
    photoURL:     "",
    kycStatus:    "pending",
    referralCode: "DEMO8888",
    isDemo:       true,
  };
}

function firebaseUserToAuthUser(u: User): AuthUser {
  return {
    uid:          u.uid,
    email:        u.email ?? "",
    displayName:  u.displayName ?? `Player${u.uid.slice(-4).toUpperCase()}`,
    photoURL:     u.photoURL ?? "",
    kycStatus:    "pending",
    referralCode: "",
    isDemo:       false,
  };
}

function profileToAuthUser(uid: string, p: UserProfile): AuthUser {
  return {
    uid,
    email:        p.email,
    displayName:  p.displayName,
    photoURL:     p.photoURL,
    kycStatus:    p.kycStatus,
    referralCode: p.referralCode,
    isDemo:       false,
  };
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    let goOffline: (() => void) | null = null;

    if (!FIREBASE_ENABLED || isDemoMode()) {
      setLoading(false);
      return () => {};
    }

    const unsubAuth = onAuthChange((firebaseUser: User | null) => {
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (goOffline)    { goOffline(); goOffline = null; }

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // ── FAST PATH: Set user immediately from Firebase Auth data ──────────────
      // This fires before any Firestore read so loading=false resolves instantly.
      // The profile subscription below will patch in the full Firestore data once
      // it arrives (displayName, referralCode, kycStatus, etc).
      setUser(firebaseUserToAuthUser(firebaseUser));
      setLoading(false);

      // ── FIRE-AND-FORGET: Ensure Firestore profile exists + update lastLoginAt ─
      // For new users: creates users/{uid} doc if createUserProfile fire-and-forget
      //   failed during signup.
      // For returning users: bumps lastLoginAt so admin "Online Right Now" works.
      ensureUserProfile(
        firebaseUser.uid,
        firebaseUser.email        ?? "",
        firebaseUser.displayName  ?? `Player${firebaseUser.uid.slice(-4).toUpperCase()}`,
        firebaseUser.photoURL     ?? "",
      ).catch(() => {});

      // ── BACKGROUND: Subscribe to Firestore profile (hydrates silently) ───────
      // Also do one getDoc so we get the latest data immediately on first load
      // even if the snapshot hasn't arrived yet.
      getUserProfile(firebaseUser.uid).then((profile) => {
        if (profile) setUser(profileToAuthUser(firebaseUser.uid, profile));
      }).catch(() => {});

      profileUnsub = subscribeUserProfile(firebaseUser.uid, (p) => {
        setUser(profileToAuthUser(firebaseUser.uid, p));
      });

      goOffline = goOnline(firebaseUser.uid);
      requestNotificationPermission(firebaseUser.uid).catch(() => {});
    });

    return () => {
      unsubAuth();
      if (profileUnsub) profileUnsub();
      if (goOffline) goOffline();
    };
  }, []);

  /**
   * Called after email auth succeeds in LoginScreen.
   * With Firebase enabled, onAuthChange fires automatically so we only need to
   * handle demo mode here and set an immediate fallback for the rare race
   * where onAuthChange hasn't fired yet.
   */
  const login = useCallback((uid: string, email: string, _isNewUser = false) => {
    if (!FIREBASE_ENABLED || isDemoMode()) {
      setUser(buildDemoUser(email));
      return;
    }
    // Set from Firebase Auth currentUser if available (instant), else build minimal user
    const fbUser = auth?.currentUser;
    setUser(
      fbUser
        ? firebaseUserToAuthUser(fbUser)
        : {
            uid, email,
            displayName: `Player${uid.slice(-4).toUpperCase()}`,
            photoURL: "", kycStatus: "pending", referralCode: "", isDemo: false,
          }
    );
    setLoading(false);
    // onAuthChange subscription above will hydrate Firestore data in the background
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const updateProfileFn = useCallback(async (
    data: Partial<Pick<AuthUser, "displayName" | "photoURL">>
  ) => {
    if (!user) return;
    setUser((prev) => prev ? { ...prev, ...data } : prev);
    if (!user.isDemo) {
      await updateUserProfile(user.uid, data);
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user || user.isDemo) return;
    const profile = await getUserProfile(user.uid);
    if (profile) setUser(profileToAuthUser(user.uid, profile));
  }, [user]);

  const value: AuthContextType = {
    user, loading,
    isLoggedIn: Boolean(user),
    login, logout,
    updateProfile: updateProfileFn,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
