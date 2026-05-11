/**
 * Auth Context — WINGGO
 * Wraps Firebase phone auth state and exposes user info to the whole app.
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
  phone: string;
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
  login: (uid: string, phone: string, isNewUser?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Pick<AuthUser, "displayName" | "photoURL">>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── DEMO USER (when Firebase not configured) ─────────────────────────────────

function buildDemoUser(phone = ""): AuthUser {
  return {
    uid:          "demo-user-001",
    phone:        phone || "+91 98765 43210",
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
    phone:        p.phone,
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

  // Keep a reference to the Firestore profile unsub
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    let goOffline: (() => void) | null = null;

    if (!FIREBASE_ENABLED || isDemoMode()) {
      // Demo mode — no auth needed
      setLoading(false);
      return () => {};
    }

    const unsubAuth = onAuthChange(async (firebaseUser: User | null) => {
      // Clean up previous profile subscription
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (goOffline)    { goOffline(); goOffline = null; }

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Fetch initial profile
      const profile = await getUserProfile(firebaseUser.uid);
      if (profile) {
        setUser(profileToAuthUser(firebaseUser.uid, profile));
      }
      setLoading(false);

      // Subscribe to live profile changes
      profileUnsub = subscribeUserProfile(firebaseUser.uid, (p) => {
        setUser(profileToAuthUser(firebaseUser.uid, p));
      });

      // Mark presence online
      goOffline = goOnline(firebaseUser.uid);

      // Request notification permission (non-blocking)
      requestNotificationPermission(firebaseUser.uid).catch(() => {});
    });

    return () => {
      unsubAuth();
      if (profileUnsub) profileUnsub();
      if (goOffline) goOffline();
    };
  }, []);

  /** Called after OTP verification succeeds */
  const login = useCallback(async (uid: string, phone: string, _isNewUser = false) => {
    if (!FIREBASE_ENABLED || isDemoMode()) {
      setUser(buildDemoUser(phone));
      return;
    }
    const profile = await getUserProfile(uid);
    if (profile) {
      setUser(profileToAuthUser(uid, profile));
    } else {
      // Profile may not be written yet — use placeholder
      setUser({
        uid, phone, displayName: `Player${uid.slice(-4).toUpperCase()}`,
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

