/**
 * DataDeletionScreen — public page at /data-deletion (no login required).
 *
 * IMPORTANT: describes the REAL deletion process. The Winggo codebase has NO
 * automatic in-app account deletion — deletion requests are handled manually
 * by support. Nothing here claims otherwise. Contact details come from the
 * live support config (config/support doc) with DEFAULT_SUPPORT_CONFIG
 * fallback.
 */

import { useEffect, useState } from "react";
import { DEFAULT_SUPPORT_CONFIG, SupportConfig, subscribeSupportConfig } from "@/firebase/firestore.service";

export default function DataDeletionScreen() {
  const [cfg, setCfg] = useState<SupportConfig>(DEFAULT_SUPPORT_CONFIG);
  useEffect(() => subscribeSupportConfig(setCfg), []);

  const mailSubject = encodeURIComponent("Winggo Account Deletion Request");
  const mailBody = encodeURIComponent(
    "Hi Winggo Support,\n\n" +
      "I request deletion of my Winggo account and personal data.\n\n" +
      "Name shown in Winggo profile: \n" +
      "Winggo username / UID (from Profile page): \n" +
      "Linked Facebook account name: \n\n" +
      "Thank you."
  );

  return (
    <div className="min-h-screen bg-[#0a0a10] text-zinc-300">
      {/* Gold glow background accents (matches app theme) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-64"
        style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(250,204,21,0.10) 0%, rgba(250,204,21,0) 100%)" }}
      />

      <div className="relative mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-yellow-300 to-yellow-500 text-2xl shadow-lg shadow-yellow-500/20">
            🗑️
          </div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">User Data Deletion</h1>
          <p className="mt-1 text-sm text-zinc-500">Winggo &middot; Last updated: November 2026</p>
        </div>

        {/* How to request */}
        <Card icon="📮" title="How to request deletion">
          <p>
            Account deletion is handled manually by our support team — there is
            currently no automatic delete button inside the app. To delete your
            Winggo account and personal data, contact us using either official
            channel:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <a
              href={`mailto:${cfg.gmail}?subject=${mailSubject}&body=${mailBody}`}
              className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 transition-colors hover:border-yellow-500/50"
            >
              <div className="text-xl">✉️</div>
              <div className="mt-1 text-sm font-bold text-white">Email support</div>
              <div className="mt-0.5 break-all text-xs text-yellow-400">{cfg.gmail}</div>
              <div className="mt-1 text-xs text-zinc-500">Tap to open a pre-filled request</div>
            </a>
            <a
              href={cfg.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-zinc-700 bg-zinc-800/60 p-4 transition-colors hover:border-yellow-500/50"
            >
              <div className="text-xl">📸</div>
              <div className="mt-1 text-sm font-bold text-white">Instagram DM</div>
              <div className="mt-0.5 text-xs text-yellow-400">@{cfg.instagramUsername}</div>
              <div className="mt-1 text-xs text-zinc-500">Message us "Delete my account"</div>
            </a>
          </div>
          <p className="mt-4 text-sm">
            To help us find your account, include your <b className="text-zinc-100">Winggo profile name</b> and{" "}
            <b className="text-zinc-100">UID</b> (visible on your Profile page in the app). We may ask a
            verification question to confirm the request is really yours.
          </p>
        </Card>

        {/* What happens */}
        <Card icon="⏱️" title="What happens after your request">
          <ul>
            <li>We confirm and verify your request with you.</li>
            <li>
              Your profile, wallet records, game history and KYC data associated
              with your account are deleted from our systems.
            </li>
            <li>
              The link between your account and Facebook login is removed from
              our side.
            </li>
            <li>
              Some financial/transaction records may be kept where required for
              legal, tax or accounting obligations — these cannot be publicly
              linked back to you afterwards.
            </li>
            <li>{cfg.supportText}</li>
          </ul>
        </Card>

        {/* Facebook data */}
        <Card icon="🔗" title="Also remove Winggo from your Facebook account">
          <p>
            Your Winggo login is connected to Facebook. After (or even without)
            your Winggo deletion request, you can revoke Winggo's access to your
            Facebook profile yourself:
          </p>
          <ol className="mt-2 space-y-1.5">
            <li>1. Open Facebook → Settings &amp; privacy → Settings.</li>
            <li>2. Go to "Apps and Websites" (Accounts Centre → Apps).</li>
            <li>3. Select Winggo and tap "Remove".</li>
          </ol>
          <p className="mt-2">
            This stops Winggo from accessing your Facebook name and photo. It
            does not delete your Winggo account — use the support request above
            for that.
          </p>
        </Card>

        {/* What is NOT deleted */}
        <Card icon="⚠️" title="Important notes">
          <ul>
            <li>
              Deleting your account is <b className="text-zinc-100">permanent</b>. Your wallet
              balance, winnings and referral progress cannot be restored later.
            </li>
            <li>
              If you have a pending withdrawal, please let us process it before
              deletion.
            </li>
            <li>
              Creating a new account after deletion starts fresh — old data is
              not recovered.
            </li>
          </ul>
        </Card>

        {/* Cross links */}
        <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center sm:p-5">
          <p className="text-sm text-zinc-300">
            Read what data Winggo collects:{" "}
            <a href="/privacy-policy" className="font-bold text-yellow-400 underline hover:text-yellow-300">
              Privacy Policy →
            </a>
          </p>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="inline-block rounded-xl bg-yellow-400 px-6 py-2.5 text-sm font-black text-black transition-colors hover:bg-yellow-300">
            ← Back to Winggo
          </a>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          © 2026 Winggo. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-black text-white sm:text-lg">
        <span>{icon}</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed [&_b]:text-zinc-100 [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
