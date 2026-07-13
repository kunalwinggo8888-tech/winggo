/**
 * Cloudinary Upload Service — WINGGO
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces Firebase Storage entirely. All file I/O (KYC documents, profile
 * photos, game thumbnails, deposit screenshots) now goes through Cloudinary's
 * unsigned-upload REST API.
 *
 * Required env vars (add to your .env / Replit Secrets / Vercel env):
 *   VITE_CLOUDINARY_CLOUD_NAME    — your Cloudinary cloud name
 *                                   (Settings → Account → Cloud name)
 *   VITE_CLOUDINARY_UPLOAD_PRESET — an unsigned upload preset
 *                                   (Settings → Upload → Upload presets → Add unsigned preset)
 *
 * Folder layout on Cloudinary:
 *   winggo/kyc/{uid}/front|back|selfie/…
 *   winggo/avatars/{uid}/…
 *   winggo/games/{gameId}/…
 *   winggo/deposits/{uid}/…
 *
 * NOTE: Client-side deletion requires a signed request (API secret), which
 * must never be exposed in browser code. deleteStorageFile() is therefore a
 * deliberate no-op. Remove files via the Cloudinary dashboard or a secure
 * server-side endpoint if needed.
 */

export type UploadResult = { url: string; path: string };

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME    ?? "";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "";

/** True when Cloudinary credentials are present */
export const CLOUDINARY_ENABLED = Boolean(CLOUD_NAME) && Boolean(UPLOAD_PRESET);

// ─── Core helper ──────────────────────────────────────────────────────────────

/**
 * Upload any file to Cloudinary.
 * @param file         The browser File object
 * @param folder       Target Cloudinary folder path (no leading slash)
 * @param resourceType "image" for photos/thumbnails, "raw" for ZIP / PDF, "auto" for best-guess
 * @returns            { url, path } on success; null when Cloudinary is not configured
 */
async function uploadToCloudinary(
  file: File,
  folder: string,
  resourceType: "image" | "raw" | "auto" = "auto",
): Promise<UploadResult | null> {
  if (!CLOUDINARY_ENABLED) {
    console.warn(
      "[Cloudinary] Not configured — skipping upload.\n" +
      "Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in your environment.",
    );
    return null;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(
      `Cloudinary upload failed (${res.status}): ${errBody.error?.message ?? res.statusText}`,
    );
  }

  const data = await res.json() as { secure_url: string; public_id: string };
  return { url: data.secure_url, path: data.public_id };
}

// ─── Public API — same signatures as the old Firebase Storage service ─────────

/** Upload a KYC document (front / back / selfie / pan) for a user */
export async function uploadKYCDocument(
  uid: string,
  file: File,
  docType: "front" | "back" | "selfie" | "pan",
): Promise<UploadResult | null> {
  return uploadToCloudinary(file, `winggo/kyc/${uid}/${docType}`, "image");
}

/** Upload a user profile photo */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
): Promise<UploadResult | null> {
  return uploadToCloudinary(file, `winggo/avatars/${uid}`, "image");
}

/** Upload a game thumbnail image */
export async function uploadGameThumbnail(
  gameId: string,
  file: File,
): Promise<UploadResult | null> {
  return uploadToCloudinary(file, `winggo/games/${gameId}`, "image");
}

/** Upload a deposit payment screenshot */
export async function uploadDepositScreenshot(
  uid: string,
  file: File,
): Promise<UploadResult | null> {
  return uploadToCloudinary(file, `winggo/deposits/${uid}`, "image");
}

/**
 * Delete a file by its Cloudinary public_id.
 *
 * ⚠️  Client-side deletion requires a signed request containing the API secret,
 *     which MUST NOT be exposed in browser code. This function is intentionally
 *     a no-op. To delete a file, use the Cloudinary dashboard or call the
 *     Destroy API from a secure backend endpoint.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteStorageFile(_publicId: string): Promise<void> {
  // no-op: server-side signed request required — see JSDoc above
}
