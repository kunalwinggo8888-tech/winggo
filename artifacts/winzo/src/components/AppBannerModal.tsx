/**
 * AppBannerModal — App-Open Welcome Banner
 * Fetches system/app_banner from Firestore (controlled live from Admin Panel).
 * Shows once per app-open session when enabled=true and imageUrl is set.
 */
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  imageUrl:  string;
  link:      string;
  onClose:   () => void;
  onNavigate:(dest: string) => void;
}

export default function AppBannerModal({ imageUrl, link, onClose, onNavigate }: Props) {

  function handleImageClick() {
    if (link && link.trim()) {
      onNavigate(link.trim());
    }
    onClose();
  }

  return (
    <AnimatePresence>
      {/* ── Backdrop ── */}
      <motion.div
        key="banner-backdrop"
        className="fixed inset-0 z-[9990] flex items-center justify-center px-5"
        style={{ maxWidth: 480, margin: "0 auto" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28 }}
        onClick={onClose}
      >
        {/* Blurred dark overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: "rgba(4,3,12,0.82)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        />

        {/* ── Modal card ── */}
        <motion.div
          key="banner-card"
          onClick={e => e.stopPropagation()}
          initial={{ scale: 0.82, opacity: 0, y: 32 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{    scale: 0.88, opacity: 0, y: 16 }}
          transition={{ type: "spring", damping: 22, stiffness: 280, duration: 0.38 }}
          className="relative w-full rounded-3xl overflow-hidden z-10"
          style={{
            maxWidth: 400,
            boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,215,0,0.12), 0 0 60px rgba(255,215,0,0.06)",
          }}
        >
          {/* Banner image — tappable */}
          <motion.div
            onClick={handleImageClick}
            whileTap={{ scale: 0.985 }}
            className="relative w-full cursor-pointer"
            style={{ background: "#0a0a0f" }}
          >
            <img
              src={imageUrl}
              alt="App Banner"
              className="w-full object-cover block"
              style={{ maxHeight: 420, minHeight: 200 }}
              draggable={false}
            />

            {/* Subtle gradient at bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}
            />

            {/* If has link — show a subtle tap hint */}
            {link && (
              <div
                className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black"
                style={{
                  background: "rgba(255,215,0,0.15)",
                  border: "1px solid rgba(255,215,0,0.3)",
                  color: "#FFD700",
                  backdropFilter: "blur(6px)",
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap",
                }}
              >
                TAP TO EXPLORE →
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* ── Close (X) button — top-right of card ── */}
        <motion.button
          key="banner-close"
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="absolute z-20 flex items-center justify-center cursor-pointer"
          style={{
            top: "calc(50% - 210px)",
            right: "calc(50% - 215px)",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.95)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            color: "#0a0a0f",
            fontSize: 16,
            fontWeight: 900,
            lineHeight: 1,
          }}
          aria-label="Close banner"
        >
          ✕
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
