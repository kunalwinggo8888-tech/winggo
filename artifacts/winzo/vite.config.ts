import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const port = process.env.PORT ? Number(process.env.PORT) : 5173;
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      strategies: "generateSW",
      includeAssets: ["favicon.svg", "icon.svg", "icon-192.png", "icon-512.png", "winggo-logo.png"],
      manifest: {
        name: "Winggo",
        short_name: "Winggo",
        description: "India's real-money skill gaming platform. Play Ludo, Carrom, Cricket & more to win instant cash rewards.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "fullscreen"],
        orientation: "portrait",
        background_color: "#07050f",
        theme_color: "#FFD700",
        lang: "en-IN",
        categories: ["games", "entertainment", "finance"],
        prefer_related_applications: false,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [],
        screenshots: [],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff,woff2,eot,ttf,ico}"],
        globIgnores: ["**/node_modules/**/*"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "font",
            handler: "CacheFirst",
            options: { cacheName: "winggo-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } },
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: { cacheName: "winggo-assets", expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
          {
            urlPattern: ({ url }) => /firestore\.googleapis\.com|googleapis\.com|firebase/.test(url.hostname + url.pathname),
            handler: "NetworkOnly",
            options: {},
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-firebase": [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
          ],
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
