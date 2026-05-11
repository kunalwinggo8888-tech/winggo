/**
 * Firebase Storage Service — WINGGO
 * Handles KYC document uploads and game thumbnail management
 */
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage, FIREBASE_ENABLED } from "./config";

export type UploadResult = { url: string; path: string };

/** Upload a KYC document for a user */
export async function uploadKYCDocument(
  uid: string,
  file: File,
  docType: "front" | "back" | "selfie"
): Promise<UploadResult | null> {
  if (!FIREBASE_ENABLED || !storage) return null;
  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `kyc/${uid}/${docType}_${Date.now()}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file, { contentType: file.type });
  const url = await getDownloadURL(sRef);
  return { url, path };
}

/** Upload a game thumbnail image (admin) */
export async function uploadGameThumbnail(
  gameId: string,
  file: File
): Promise<UploadResult | null> {
  if (!FIREBASE_ENABLED || !storage) return null;
  const ext  = file.name.split(".").pop() ?? "png";
  const path = `games/${gameId}/thumbnail_${Date.now()}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file, { contentType: file.type });
  const url = await getDownloadURL(sRef);
  return { url, path };
}

/** Upload a user profile photo */
export async function uploadProfilePhoto(
  uid: string,
  file: File
): Promise<UploadResult | null> {
  if (!FIREBASE_ENABLED || !storage) return null;
  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `avatars/${uid}/photo_${Date.now()}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file, { contentType: file.type });
  const url = await getDownloadURL(sRef);
  return { url, path };
}

/** Delete a file from Storage */
export async function deleteStorageFile(path: string): Promise<void> {
  if (!FIREBASE_ENABLED || !storage) return;
  await deleteObject(storageRef(storage, path));
}
