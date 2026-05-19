import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadProfilePhoto } from "@/firebase/storage.service";
import { updateProfile as fbUpdateProfile } from "firebase/auth";
import { auth } from "@/firebase/config";
import { useAuth } from "@/context/useAuth";

interface AvatarUploadProps {
  size?: number;
  showEditHint?: boolean;
}

export default function AvatarUpload({ size = 36, showEditHint = false }: AvatarUploadProps) {
  const { user, updateProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initial =
    user?.displayName?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "?";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";
    setUploading(true);
    try {
      const result = await uploadProfilePhoto(user.uid, file);
      if (result?.url) {
        if (auth?.currentUser) {
          await fbUpdateProfile(auth.currentUser, { photoURL: result.url });
        }
        await updateProfile({ photoURL: result.url });
      }
    } catch {
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <motion.button
        data-testid="button-profile-avatar"
        whileTap={{ scale: 0.93 }}
        onClick={() => inputRef.current?.click()}
        className="relative shrink-0 cursor-pointer"
        style={{ width: size, height: size, borderRadius: "50%" }}
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt="avatar"
            className="w-full h-full rounded-full object-cover"
            style={{ border: "2px solid rgba(255,215,0,0.55)" }}
          />
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center font-black select-none"
            style={{
              background: "linear-gradient(135deg, #FFD700, #ff8c00)",
              fontSize: size * 0.38,
              color: "#000",
              boxShadow: "0 0 10px rgba(255,215,0,0.4)",
            }}
          >
            {initial}
          </div>
        )}

        <AnimatePresence>
          {uploading && (
            <motion.div
              className="absolute inset-0 rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <motion.div
                className="rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                style={{
                  width: size * 0.55,
                  height: size * 0.55,
                  border: `${Math.max(2, size * 0.05)}px solid rgba(255,215,0,0.25)`,
                  borderTopColor: "#FFD700",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {showEditHint && !uploading && (
          <div
            className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
            style={{
              width: size * 0.33,
              height: size * 0.33,
              background: "linear-gradient(135deg, #FFD700, #ff8c00)",
              border: "2px solid #07050f",
              fontSize: size * 0.16,
            }}
          >
            📷
          </div>
        )}
      </motion.button>
    </>
  );
}
