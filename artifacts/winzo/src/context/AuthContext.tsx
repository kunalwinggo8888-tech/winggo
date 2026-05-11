/**
 * Auth Context — WINGGO
 * Wraps Firebase email/password auth state and exposes user info to the whole app.
 * Works in demo mode when Firebase is not configured.
 *
 * NOTE: useAuth hook lives in ./useAuth.ts (separate file) so Vite Fast Refresh
 * can HMR this provider without the "incompatible exports" cascade that breaks
 * the context chain during development.
 */
import {
  createContext, useState, useEffect,
  useCallback, ReactNode,
} from "react";
import { User } from "firebase/auth";
import { FIREBASE_ENABLED } from "@/firebase/config";
import { onAuthChange, logoutUser, isDemoMode } from "@/firebase/auth.service";
import {
  getUserProfile, subscribeUserProfile,
  UserProfile, updateUserProfile,
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
  login: (uid: string, email: string, isNewUser?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Pick<AuthUser, "displayName" | "photoURL">>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── DEMO USER (when Firebase not configured) ─────────────────────────────────

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

    const unsubAuth = onAuthChange(async (firebaseUser: User | null) => {
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (goOffline)    { goOffline(); goOffline = null; }

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const profile = await getUserProfile(firebaseUser.uid);
      if (profile) {
        setUser(profileToAuthUser(firebaseUser.uid, profile));
      } else {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? "",
          displayName: firebaseUser.displayName ?? `Player${firebaseUser.uid.slice(-4).toUpperCase()}`,
          photoURL: firebaseUser.photoURL ?? "",
          kycStatus: "pending",
          referralCode: "",
          isDemo: false,
        });
      }
      setLoading(false);

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

  /** Called after email auth succeeds */
  const login = useCallback(async (uid: string, email: string, _isNewUser = false) => {
    if (!FIREBASE_ENABLED || isDemoMode()) {
      setUser(buildDemoUser(email));
      return;
    }
    const profile = await getUserProfile(uid);
    if (profile) {
      setUser(profileToAuthUser(uid, profile));
    } else {
      setUser({
        uid, email,
        displayName: `Player${uid.slice(-4).toUpperCase()}`,
        photoURL: "", kycStatus: "pending", referralCode: "", isDemo: false,
      });
    }
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
