/**
 * Referral Service — WINGGO
 * -------------------------------------------------
 * End-to-end referral attribution for the PWA:
 *
 *   https://your-domain.com/?ref=USER_CODE
 *
 * - captureReferralFromUrl()  → reads `?ref`, stores it for later attribution
 * - trackReferralClick()      → increments a global click counter per code
 * - trackReferralInstall()    → increments an install counter (called when the
 *                               PWA is actually installed onto the device)
 * - claimReferral()           → called once at signup/first-login; attributes
 *                               the new user to the referrer, credits a bonus
 *                               to the referrer's wallet and bumps the signup
 *                               / earnings counters.
 *
 * Everything is fire-and-forget and safely no-ops when Firebase is disabled
 * (demo mode) or any single step fails — it never blocks the UI.
 */
import { doc, collection, query, where, limit, getDocs, getDoc, increment, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, FIREBASE_ENABLED } from "./config";

const PENDING_KEY = "winggo.ref";
const SEEN_KEY = "winggo.ref.seen";

export const REFERRAL_BONUS = 50; // ₹ default (kept in sync with AppConfig.referralBonusAmount)

/** Normalise an arbitrary referral code string (uppercase, trimmed). */
function normalise(code: string | null | undefined): string {
  return (code || "").trim().toUpperCase();
}

/**
 * Read `?ref=CODE` from the current URL, store it for later attribution, and
 * return the code (or null). Called once when the app boots.
 */
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = normalise(params.get("ref"));
    if (code) localStorage.setItem(PENDING_KEY, code);
    return code || getPendingReferral();
  } catch {
    return getPendingReferral();
  }
}

/** The referral code currently pending attribution (from URL), if any. */
export function getPendingReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalise(localStorage.getItem(PENDING_KEY)) || null;
  } catch {
    return null;
  }
}

/** Wipe the pending referral (after it has been claimed). */
export function clearPendingReferral(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* no-op */ }
}

async function countersDocRef(code: string) {
  return doc(db!, "referrals", code);
}

/** Count a click on a referral link once per session. Fire-and-forget. */
export async function trackReferralClick(code: string | null): Promise<void> {
  const c = normalise(code);
  if (!c || !FIREBASE_ENABLED || !db) return;
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SEEN_KEY + c)) return;
    const ref = await countersDocRef(c);
    await updateDoc(ref, { clicks: increment(1), lastClickAt: serverTimestamp() }).catch(() =>
      setDoc(ref, { clicks: 1, installs: 0, signups: 0, totalReferralEarnings: 0, createdAt: serverTimestamp(), referrerUid: "" }, { merge: true }),
    );
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(SEEN_KEY + c, "1");
  } catch { /* non-fatal */ }
}

/** Count a PWA install that happened after opening a referral link. */
export async function trackReferralInstall(code: string | null): Promise<void> {
  const c = normalise(code);
  if (!c || !FIREBASE_ENABLED || !db) return;
  try {
    const ref = await countersDocRef(c);
    await updateDoc(ref, { installs: increment(1) }).catch(() =>
      setDoc(ref, { clicks: 1, installs: 1, signups: 0, totalReferralEarnings: 0, createdAt: serverTimestamp(), referrerUid: "" }, { merge: true }),
    );
  } catch { /* non-fatal */ }
}

/**
 * Called exactly once per user (on signup / first login). Looks up the referrer
 * by their code, attributes this user to them, and gives the referrer a bonus.
 * @param newUserUid the uid of the newly-registered user
 * @param myCode     the new user's own referral code (avoids self-referral)
 * @param bonus      bonus amount to credit to the referrer (default ₹50)
 */
export async function claimReferral(newUserUid: string, myCode: string, bonus = REFERRAL_BONUS): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const normalized = normalise(getPendingReferral());
  if (!normalized || normalized === normalise(myCode)) { clearPendingReferral(); return; }

  try {
    const q = query(collection(db, "users"), where("referralCode", "==", normalized), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) { clearPendingReferral(); return; }

    const referrerUid = snap.docs[0].id;
    if (referrerUid === newUserUid) { clearPendingReferral(); return; }

    // 1) Mark the new user's profile as referred (only if not already set)
    const me = doc(db, "users", newUserUid);
    const meSnap = await getDoc(me);
    const already = meSnap.exists() && meSnap.data().referredBy;
    await setDoc(me, { referredBy: referrerUid }, { merge: !already });

    // 2) Bump the referrer's referral stats
    const referrerDoc = doc(db, "users", referrerUid);
    await updateDoc(referrerDoc, {
      totalFriendsJoined: increment(1),
      totalReferralEarnings: increment(bonus),
      pendingReferralBonus: increment(bonus),
    });

    // 3) Credit the referrer's wallet with the bonus
    const { firestoreAddBonus } = await import("./firestore.service");
    await firestoreAddBonus(referrerUid, bonus, "Referral Bonus — a friend joined with your code");

    // 4) Bump the global counters and link them to the referrer
    await setDoc(await countersDocRef(normalized), { signups: increment(1), referrerUid }, { merge: true });

    clearPendingReferral();
  } catch { /* non-fatal */ }
}