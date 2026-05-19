/**
 * PageCodeEditor — WINGGO Admin
 * Module 2: Master Code Editor (All-in-One)
 * - Monaco Editor with dark theme
 * - Virtual file system backed by Firestore
 * - Save to cloud + Deploy Live
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import {
  loadCodeFiles, saveCodeFile, deployCodeFile,
  CodeFileEntry, FIREBASE_ENABLED,
} from "@/firebase/admin.service";

// ─── THEME ────────────────────────────────────────────────────────────────────

const T = {
  blue:   "#00d4ff",
  green:  "#00ff88",
  gold:   "#f59e0b",
  red:    "#ff3366",
  purple: "#a78bfa",
  muted:  "rgba(226,232,240,0.38)",
  bg:     "#070b12",
  card:   "#0a0f1a",
};

// ─── FILE DEFINITIONS ─────────────────────────────────────────────────────────

interface FileDef { name: string; lang: string; icon: string; desc: string; template: string }

const FILES: FileDef[] = [
  {
    name: "index.html", lang: "html", icon: "🌐", desc: "Main game entry point",
    template: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WINGGO Game</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="game-container">
    <!-- Game content goes here -->
  </div>
  <script src="game_logic.js"></script>
</body>
</html>`,
  },
  {
    name: "style.css", lang: "css", icon: "🎨", desc: "Game styles & theme",
    template: `/* WINGGO Game Styles */

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #070b12;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

#game-container {
  width: 100%;
  max-width: 480px;
  min-height: 100vh;
  background: #0a0f1a;
}`,
  },
  {
    name: "game_logic.js", lang: "javascript", icon: "⚡", desc: "Game logic & behavior",
    template: `// WINGGO Game Logic
// This file controls the game mechanics

const GAME_CONFIG = {
  name: 'WINGGO Game',
  version: '1.0.0',
  fps: 60,
};

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.init();
  }

  init() {
    console.log(\`\${GAME_CONFIG.name} v\${GAME_CONFIG.version} loaded!\`);
    // Initialize game state here
  }

  start() {
    // Start game loop
    requestAnimationFrame(() => this.loop());
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  update() {
    // Update game state
  }

  render() {
    // Render frame
  }
}

const game = new Game();`,
  },
  {
    name: "app.config.json", lang: "json", icon: "⚙️", desc: "App-wide configuration",
    template: `{
  "appName": "WINGGO",
  "version": "1.0.0",
  "features": {
    "spinWheel": true,
    "referrals": true,
    "tournaments": false
  },
  "entryBonusAmount": 50,
  "referralBonusAmount": 25,
  "minDepositAmount": 10,
  "maxWithdrawPerDay": 10000
}`,
  },
  {
    name: "custom.css", lang: "css", icon: "🖌️", desc: "Live CSS override — injected globally",
    template: `/* Custom CSS — injected into the live app */
/* Changes here affect the admin panel and app appearance */

/* Example: override primary accent color */
/* :root { --primary: #00d4ff; } */

/* Example: hide an element */
/* .some-class { display: none !important; } */`,
  },
  {
    name: "custom.js", lang: "javascript", icon: "🔥", desc: "Live JS override — runs on deploy",
    template: `// Custom JavaScript — executed on deploy
// Use this to patch live app behavior without redeploying

console.log('[WINGGO] Custom JS loaded from Firebase');

// Example: log all navigation events
// document.addEventListener('click', (e) => console.log('Clicked:', e.target));

// Example: override a global function
// window.originalFn = window.myFn;
// window.myFn = function(...args) {
//   console.log('Patched:', args);
//   return window.originalFn(...args);
// };`,
  },
];

// ─── FILES THAT FEED THE PREVIEW ──────────────────────────────────────────────
const PREVIEWABLE = new Set(["index.html", "style.css", "game_logic.js"]);

// ─── BUILD SELF-CONTAINED SRCDOC ──────────────────────────────────────────────
function buildSrcdoc(contents: Record<string, string>): string {
  const html = contents["index.html"] ?? FILES[0].template;
  const css  = contents["style.css"]  ?? FILES[1].template;
  const js   = contents["game_logic.js"] ?? FILES[2].template;
  return html
    .replace(/<link[^>]*href=["']style\.css["'][^>]*\/?>/gi,          `<style>\n${css}\n</style>`)
    .replace(/<script[^>]*src=["']game_logic\.js["'][^>]*><\/script>/gi, `<script>\n${js}\n</script>`);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtAgo(ts: number | undefined): string {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5)    return "just now";
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

type SaveStatus   = "idle" | "saving"    | "saved"    | "error";
type DeployStatus = "idle" | "deploying" | "deployed" | "error";
type MobileView   = "editor" | "preview";

export default function PageCodeEditor() {
  const [activeFile, setActiveFile]     = useState<string>(FILES[0].name);
  const [contents, setContents]         = useState<Record<string, string>>({});
  const [metadata, setMetadata]         = useState<Record<string, CodeFileEntry>>({});
  const [loading, setLoading]           = useState(true);
  const [saveStatus, setSaveStatus]     = useState<SaveStatus>("idle");
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("idle");
  const [mobileFilePicker, setMFP]      = useState(false);

  // ── Preview state ────────────────────────────────────────────────────────
  const [previewSrc, setPreviewSrc]   = useState<string>("");
  const [previewKey, setPreviewKey]   = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [mobileView, setMobileView]   = useState<MobileView>("editor");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fileDef = FILES.find((f) => f.name === activeFile) ?? FILES[0];
  const content = contents[activeFile] ?? fileDef.template;

  // ── Load all files from Firestore on mount ───────────────────────────────
  useEffect(() => {
    loadCodeFiles().then((map) => {
      const newContents: Record<string, string> = {};
      FILES.forEach((f) => {
        newContents[f.name] = map[f.name]?.content ?? f.template;
      });
      setContents(newContents);
      setMetadata(map);
      setLoading(false);
    });
  }, []);

  const handleEditorChange = useCallback((val: string | undefined) => {
    const v = val ?? "";
    setContents((prev) => ({ ...prev, [activeFile]: v }));
    setSaveStatus("idle");
    setDeployStatus("idle");
  }, [activeFile]);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveStatus("saving");
    try {
      await saveCodeFile(activeFile, content);
      setMetadata((prev) => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], content, savedAt: Date.now() },
      }));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    }
  }

  // ── Deploy Live ───────────────────────────────────────────────────────────
  async function handleDeploy() {
    setDeployStatus("deploying");
    try {
      await deployCodeFile(activeFile, content);
      setMetadata((prev) => ({
        ...prev,
        [activeFile]: { ...prev[activeFile], content, savedAt: Date.now(), deployedAt: Date.now() },
      }));
      setDeployStatus("deployed");
      setTimeout(() => setDeployStatus("idle"), 4000);
    } catch {
      setDeployStatus("error");
    }
  }

  // ── Refresh Preview ───────────────────────────────────────────────────────
  function handleRefreshPreview() {
    setPreviewSrc(buildSrcdoc(contents));
    setPreviewKey((k) => k + 1);
    setMobileView("preview");
  }

  const fileMeta = metadata[activeFile];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 57px)" }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ background: "#0a0f1a", borderBottom: "1px solid rgba(0,212,255,0.1)" }}>

        {/* Mobile: file picker trigger */}
        <button className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer"
          style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.18)" }}
          onClick={() => setMFP(true)}>
          <span className="text-base">{fileDef.icon}</span>
          <span className="text-xs font-black" style={{ color: T.blue }}>{activeFile}</span>
          <span className="text-xs" style={{ color: T.muted }}>▾</span>
        </button>

        {/* Filename on desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-lg">{fileDef.icon}</span>
          <span className="text-sm font-black text-white">{activeFile}</span>
          <span className="text-[10px] px-2 py-0.5 rounded font-black"
            style={{ background: "rgba(0,212,255,0.1)", color: T.blue }}>{fileDef.lang.toUpperCase()}</span>
        </div>

        <div className="flex-1" />

        {/* Meta: saved / deployed timestamps */}
        <div className="hidden sm:flex items-center gap-3 text-[10px]" style={{ color: T.muted }}>
          {fileMeta?.savedAt && (
            <span>💾 Saved {fmtAgo(fileMeta.savedAt)}</span>
          )}
          {fileMeta?.deployedAt && (
            <span style={{ color: T.green }}>🚀 Deployed {fmtAgo(fileMeta.deployedAt)}</span>
          )}
          {!FIREBASE_ENABLED && (
            <span style={{ color: T.gold }}>⚠️ Demo mode — changes won't persist</span>
          )}
        </div>

        {/* Refresh Preview */}
        <motion.button whileTap={{ scale: 0.94 }} onClick={handleRefreshPreview}
          title="Render HTML + CSS + JS in the preview panel"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
          style={{
            background: "rgba(167,139,250,0.1)",
            color: T.purple,
            border: "1px solid rgba(167,139,250,0.25)",
          }}>
          🔄 <span className="hidden sm:inline">Refresh Preview</span>
        </motion.button>

        {/* Toggle preview panel — desktop only */}
        <button onClick={() => setShowPreview((v) => !v)}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black cursor-pointer"
          style={{
            background: showPreview ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${showPreview ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}`,
            color: showPreview ? T.purple : T.muted,
          }}>
          {showPreview ? "◧" : "□"} <span>Preview</span>
        </button>

        {/* Save */}
        <motion.button whileTap={{ scale: 0.94 }} onClick={handleSave}
          disabled={saveStatus === "saving"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
          style={{
            background: saveStatus === "saved"  ? "rgba(0,255,136,0.1)"  :
                        saveStatus === "error"   ? "rgba(255,51,102,0.1)" :
                        "rgba(0,212,255,0.08)",
            color:      saveStatus === "saved"  ? T.green :
                        saveStatus === "error"   ? T.red   :
                        T.blue,
            border: `1px solid ${saveStatus === "saved" ? "rgba(0,255,136,0.25)" : saveStatus === "error" ? "rgba(255,51,102,0.25)" : "rgba(0,212,255,0.2)"}`,
          }}>
          {saveStatus === "saving"  ? "⏳" : saveStatus === "saved" ? "✓" : saveStatus === "error" ? "✕" : "💾"}
          <span className="hidden sm:inline">
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Failed" : "Save"}
          </span>
        </motion.button>

        {/* Deploy */}
        <motion.button whileTap={{ scale: 0.94 }} onClick={handleDeploy}
          disabled={deployStatus === "deploying"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
          style={{
            background: deployStatus === "deployed" ? "rgba(0,255,136,0.12)" :
                        deployStatus === "error"    ? "rgba(255,51,102,0.1)"  :
                        "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,85,255,0.2))",
            color:      deployStatus === "deployed" ? T.green :
                        deployStatus === "error"    ? T.red   :
                        T.blue,
            border: `1px solid ${deployStatus === "deployed" ? "rgba(0,255,136,0.3)" : deployStatus === "error" ? "rgba(255,51,102,0.25)" : "rgba(0,212,255,0.3)"}`,
            boxShadow: deployStatus === "deployed" ? "0 0 16px rgba(0,255,136,0.12)" :
                       deployStatus !== "error" && deployStatus !== "deploying" ? "0 0 16px rgba(0,212,255,0.1)" : "none",
          }}>
          {deployStatus === "deploying" ? "⏳" : deployStatus === "deployed" ? "✅" : deployStatus === "error" ? "✕" : "🚀"}
          <span className="hidden sm:inline">
            {deployStatus === "deploying" ? "Deploying…" : deployStatus === "deployed" ? "Deployed!" : deployStatus === "error" ? "Failed" : "Deploy Live"}
          </span>
        </motion.button>
      </div>

      {/* ── Mobile tab bar: Code | Preview ─────────────────────────────────── */}
      <div className="lg:hidden flex shrink-0"
        style={{ background: "#080d18", borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
        {(["editor", "preview"] as MobileView[]).map((tab) => {
          const active = mobileView === tab;
          return (
            <button key={tab} onClick={() => setMobileView(tab)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black cursor-pointer"
              style={{
                color: active ? (tab === "preview" ? T.purple : T.blue) : T.muted,
                borderBottom: `2px solid ${active ? (tab === "preview" ? T.purple : T.blue) : "transparent"}`,
                background: active ? "rgba(255,255,255,0.03)" : "transparent",
              }}>
              {tab === "editor" ? "📝 Code Editor" : "👁️ Live Preview"}
            </button>
          );
        })}
      </div>

      {/* ── Main editor area ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* File sidebar — desktop */}
        <div className="hidden lg:flex flex-col w-44 shrink-0 overflow-y-auto"
          style={{ background: "#080d18", borderRight: "1px solid rgba(0,212,255,0.1)" }}>
          <div className="px-3 pt-3 pb-2">
            <p className="text-[9px] font-black tracking-[0.15em]" style={{ color: "rgba(0,212,255,0.35)" }}>FILES</p>
          </div>
          {FILES.map((f) => {
            const isActive = f.name === activeFile;
            const meta = metadata[f.name];
            return (
              <button key={f.name} onClick={() => setActiveFile(f.name)}
                className="w-full flex items-center gap-2 px-3 py-2.5 cursor-pointer text-left"
                style={{
                  background:   isActive ? "rgba(0,212,255,0.08)" : "transparent",
                  borderLeft:   `2px solid ${isActive ? T.blue : "transparent"}`,
                  borderRight:  "2px solid transparent",
                  transition:   "all 0.15s",
                }}>
                <span className="text-sm shrink-0">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black truncate" style={{ color: isActive ? T.blue : "#e2e8f0" }}>
                    {f.name}
                  </p>
                  {meta?.deployedAt && (
                    <p className="text-[9px] leading-tight" style={{ color: "rgba(0,255,136,0.5)" }}>🚀 live</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── DESKTOP: editor + optional preview side-by-side ──────────────── */}
        <div className="hidden lg:flex flex-1 min-w-0">

          {/* Editor panel */}
          <div className="relative min-w-0"
            style={{
              width: showPreview ? "50%" : "100%",
              transition: "width 0.22s ease",
              borderRight: showPreview ? "1px solid rgba(167,139,250,0.15)" : "none",
            }}>
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: "#1e1e1e" }}>
                <motion.div className="w-8 h-8 rounded-full border-2"
                  style={{ borderColor: `${T.blue} transparent transparent transparent` }}
                  animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
                <p className="text-xs font-bold" style={{ color: T.muted }}>Loading files from Firebase…</p>
              </div>
            ) : (
              <Editor height="100%" language={fileDef.lang} theme="vs-dark" value={content}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: true, scale: 1 }, fontSize: 13, lineHeight: 22,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  fontLigatures: true, lineNumbers: "on", wordWrap: "on", automaticLayout: true,
                  scrollBeyondLastLine: false, padding: { top: 12, bottom: 24 },
                  renderLineHighlight: "all", smoothScrolling: true, cursorBlinking: "smooth",
                  bracketPairColorization: { enabled: true }, guides: { bracketPairs: true }, tabSize: 2,
                }} />
            )}
          </div>

          {/* Preview panel */}
          <AnimatePresence>
            {showPreview && (
              <motion.div key="preview"
                initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 32 }} transition={{ duration: 0.18 }}
                className="flex flex-col min-w-0" style={{ width: "50%" }}>
                {/* Preview header */}
                <div className="shrink-0 flex items-center gap-2 px-3 py-2"
                  style={{ background: "#080d18", borderBottom: "1px solid rgba(167,139,250,0.15)" }}>
                  <motion.div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: previewSrc ? T.green : T.muted }}
                    animate={previewSrc ? { opacity: [1, 0.3, 1] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }} />
                  <span className="text-xs font-black" style={{ color: T.purple }}>LIVE PREVIEW</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-black"
                    style={{ background: "rgba(167,139,250,0.1)", color: T.purple, border: "1px solid rgba(167,139,250,0.2)" }}>
                    HTML + CSS + JS
                  </span>
                  {previewSrc && (
                    <span className="ml-auto text-[10px]" style={{ color: T.muted }}>sandbox · scripts only</span>
                  )}
                </div>
                {/* iframe / placeholder */}
                <div className="flex-1 relative min-h-0">
                  {previewSrc ? (
                    <iframe key={previewKey} ref={iframeRef} srcDoc={previewSrc}
                      sandbox="allow-scripts" title="Live Preview"
                      className="absolute inset-0 w-full h-full border-0"
                      style={{ background: "#fff" }} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center"
                      style={{ background: "#080d18" }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                        <span className="text-3xl">👁️</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-white mb-1">Preview ready</p>
                        <p className="text-xs leading-relaxed" style={{ color: T.muted }}>
                          Click <span className="font-black" style={{ color: T.purple }}>Refresh Preview</span> to
                          render your HTML, CSS and JS here safely — changes won't go live until you deploy.
                        </p>
                      </div>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={handleRefreshPreview}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black cursor-pointer"
                        style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: T.purple }}>
                        🔄 Refresh Preview
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── MOBILE: Code tab ────────────────────────────────────────────────── */}
        <div className={`lg:hidden relative flex-1 min-w-0 ${mobileView === "editor" ? "block" : "hidden"}`}>
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: "#1e1e1e" }}>
              <motion.div className="w-8 h-8 rounded-full border-2"
                style={{ borderColor: `${T.blue} transparent transparent transparent` }}
                animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
              <p className="text-xs font-bold" style={{ color: T.muted }}>Loading files from Firebase…</p>
            </div>
          ) : (
            <Editor height="100%" language={fileDef.lang} theme="vs-dark" value={content}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false }, fontSize: 13, lineHeight: 22,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                lineNumbers: "on", wordWrap: "on", automaticLayout: true,
                scrollBeyondLastLine: false, padding: { top: 12, bottom: 24 }, tabSize: 2,
              }} />
          )}
        </div>

        {/* ── MOBILE: Preview tab ──────────────────────────────────────────────── */}
        <div className={`lg:hidden flex-1 min-w-0 min-h-0 flex-col ${mobileView === "preview" ? "flex" : "hidden"}`}>
          <div className="shrink-0 flex items-center gap-2 px-3 py-2"
            style={{ background: "#080d18", borderBottom: "1px solid rgba(167,139,250,0.15)" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full"
              style={{ background: previewSrc ? T.green : T.muted }}
              animate={previewSrc ? { opacity: [1, 0.3, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="text-xs font-black" style={{ color: T.purple }}>LIVE PREVIEW</span>
          </div>
          <div className="flex-1 relative min-h-0">
            {previewSrc ? (
              <iframe key={previewKey} srcDoc={previewSrc} sandbox="allow-scripts"
                title="Live Preview (mobile)" className="absolute inset-0 w-full h-full border-0"
                style={{ background: "#fff" }} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
                style={{ background: "#080d18" }}>
                <span className="text-4xl">👁️</span>
                <p className="text-xs" style={{ color: T.muted }}>
                  Tap <span style={{ color: T.purple }}>🔄 Refresh Preview</span> in the toolbar to render your code.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 text-[10px]"
        style={{ background: "rgba(0,212,255,0.06)", borderTop: "1px solid rgba(0,212,255,0.1)" }}>
        <div className="flex items-center gap-3">
          <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: T.blue }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
          <span style={{ color: T.blue }}>Monaco Editor</span>
          <span style={{ color: T.muted }}>·</span>
          <span style={{ color: T.muted }}>{fileDef.desc}</span>
        </div>
        <div className="flex items-center gap-3" style={{ color: T.muted }}>
          {previewSrc && <span style={{ color: T.purple }}>👁️ Preview active</span>}
          <span>{fileDef.lang.toUpperCase()}</span>
          <span>UTF-8</span>
          <span>LF</span>
        </div>
      </div>

      {/* ── Mobile file picker overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {mobileFilePicker && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 lg:hidden"
              style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setMFP(false)} />
            <motion.div key="panel"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 lg:hidden rounded-t-2xl overflow-hidden"
              style={{ background: "#0a0f1a", border: "1px solid rgba(0,212,255,0.18)", maxHeight: "70vh" }}>
              <div className="px-4 pt-4 pb-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
                <p className="text-sm font-black text-white">Select File</p>
                <button onClick={() => setMFP(false)} style={{ color: T.muted }}>✕</button>
              </div>
              <div className="overflow-y-auto divide-y" style={{ borderColor: "rgba(0,212,255,0.07)" }}>
                {FILES.map((f) => {
                  const isActive = f.name === activeFile;
                  return (
                    <button key={f.name}
                      onClick={() => { setActiveFile(f.name); setMFP(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                      style={{ background: isActive ? "rgba(0,212,255,0.07)" : "transparent" }}>
                      <span className="text-xl">{f.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate" style={{ color: isActive ? T.blue : "#e2e8f0" }}>{f.name}</p>
                        <p className="text-[10px]" style={{ color: T.muted }}>{f.desc}</p>
                      </div>
                      {isActive && <span style={{ color: T.blue }}>●</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
