/**
 * Firebase Cloud Messaging Service — WINGGO
 * Handles push notification token registration and permission
 */
import { FIREBASE_ENABLED, app } from "./config";
import { updateFCMToken } from "./firestore.service";

let _messaging: { getToken: (options: { vapidKey: string }) => Promise<string>; onMessage: (cb: (payload: unknown) => void) => () => void } | null = null;

async function getMessaging() {
  if (!FIREBASE_ENABLED || !app) return null;
  if (_messaging) return _messaging;
  try {
    const { getMessaging: getFBMessaging, getToken, onMessage } = await import("firebase/messaging");
    const m = getFBMessaging(app);
    _messaging = {
      getToken: (opts) => getToken(m, opts),
      onMessage: (cb) => {
        onMessage(m, cb);
        return () => {};
      },
    };
    return _messaging;
  } catch {
    return null;
  }
}

/** Request notification permission and get FCM token */
export async function requestNotificationPermission(uid: string): Promise<string | null> {
  if (!FIREBASE_ENABLED) return null;
  if (!("Notification" in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "";
  if (!vapidKey) return null;

  const messaging = await getMessaging();
  if (!messaging) return null;

  try {
    const token = await messaging.getToken({ vapidKey });
    if (token && uid) await updateFCMToken(uid, token);
    return token;
  } catch {
    return null;
  }
}

/** Listen to foreground push messages */
export async function onForegroundMessage(
  cb: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void
): Promise<() => void> {
  const messaging = await getMessaging();
  if (!messaging) return () => {};
  return messaging.onMessage(cb as (p: unknown) => void);
}

/** Show a local browser notification */
export function showLocalNotification(title: string, body: string, icon = "/logo.png"): void {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon });
  }
}
