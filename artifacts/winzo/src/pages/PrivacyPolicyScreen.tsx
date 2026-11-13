/**
 * PrivacyPolicyScreen — public page at /privacy-policy (no login required).
 *
 * IMPORTANT: every claim here reflects what the Winggo code ACTUALLY does
 * (audited): Facebook public_profile login, Firestore profile/wallet/KYC
 * records, RTDB presence, Cloudinary image uploads, Razorpay payments.
 * Contact details come from the live support config (config/support doc)
 * with DEFAULT_SUPPORT_CONFIG as fallback.
 */

import { useEffect, useState } from "react";
import { DEFAULT_SUPPORT_CONFIG, SupportConfig, subscribeSupportConfig } from "@/firebase/firestore.service";

interface Section {
  icon: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    icon: "📋",
    title: "1. Overview",
    body: (
      <>
        <p>
          Winggo ("we", "us") operates a real-money skill-gaming platform. This
          policy explains what personal data we collect when you use the Winggo
          app or website, how we use it, who we share it with, and how you can
          request its deletion.
        </p>
        <p>
          By creating an account you agree to this policy. If you do not agree,
          please do not use Winggo.
        </p>
      </>
    ),
  },
  {
    icon: "📥",
    title: "2. What data we collect",
    body: (
      <>
        <p className="font-semibold text-yellow-300">a) Account &amp; login data</p>
        <ul>
          <li>
            When you log in with Facebook, we receive your <b>public profile</b>{" "}
            — your <b>name</b> and <b>profile photo</b>. This is the only
            Facebook permission we request.
          </li>
          <li>
            Your <b>email address</b> is optional. We only have it if your login
            provider supplies it or if you link an older account. Login works
            without it.
          </li>
          <li>
            A unique account ID (UID) is created and used across your profile,
            wallet, referrals and game records.
          </li>
        </ul>
        <p className="font-semibold text-yellow-300">b) Profile data</p>
        <ul>
          <li>Display name and profile photo (synced from Facebook).</li>
          <li>Account creation date and last-login time.</li>
          <li>
            Basic device information — your browser's user-agent string —
            recorded at signup to help prevent fraud and multiple accounts.
          </li>
        </ul>
        <p className="font-semibold text-yellow-300">c) Wallet &amp; payments data</p>
        <ul>
          <li>Wallet balances (deposits, winnings, bonus amounts).</li>
          <li>
            Transaction history — deposits, withdrawals, game entries, wins and
            bonuses. Deposits made through our payment gateway (Razorpay) store
            the payment reference IDs so deposits can be verified.
          </li>
        </ul>
        <p className="font-semibold text-yellow-300">d) Withdrawal details</p>
        <ul>
          <li>
            When you request a withdrawal you provide a <b>UPI ID</b> or{" "}
            <b>bank account details</b> (account holder name, account number,
            IFSC code, bank name). These are stored only to process your
            withdrawal.
          </li>
        </ul>
        <p className="font-semibold text-yellow-300">e) KYC data</p>
        <ul>
          <li>
            Our KYC (Know Your Customer) step currently verifies your{" "}
            <b>10-digit mobile number</b>, stored with your KYC request.
          </li>
          <li>
            The KYC system also supports document images (uploaded to
            Cloudinary) if document verification is enabled for your account.
          </li>
        </ul>
        <p className="font-semibold text-yellow-300">f) Gameplay &amp; referral data</p>
        <ul>
          <li>
            Game results, scores and match history for your account.
          </li>
          <li>
            Your referral code, who referred you, and referral earnings; referral
            link clicks are counted anonymously.
          </li>
          <li>
            Online presence (whether your account is online and when it was last
            seen) is used for matchmaking — it stores your account ID, name and
            photo during a match.
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: "🎯",
    title: "3. How we use your data",
    body: (
      <ul>
        <li>Create and operate your Winggo account and profile.</li>
        <li>Run games, matches and leaderboards.</li>
        <li>Process deposits, maintain your wallet and pay out winnings.</li>
        <li>Verify identity (KYC) and process withdrawals securely.</li>
        <li>Prevent fraud, cheating and multiple/banned accounts.</li>
        <li>Provide customer support through our official channels.</li>
        <li>Send service notifications about your account and transactions.</li>
      </ul>
    ),
  },
  {
    icon: "🤝",
    title: "4. Third-party services we rely on",
    body: (
      <ul>
        <li>
          <b>Firebase / Google Cloud</b> — authentication, account storage and
          databases (profile, wallet, game data).
        </li>
        <li>
          <b>Facebook (Meta)</b> — the login provider; receives only the
          public_profile permission request.
        </li>
        <li>
          <b>Razorpay</b> — payment processing for deposits/withdrawals.
        </li>
        <li>
          <b>Cloudinary</b> — image hosting for profile photos and KYC
          documents (if uploaded).
        </li>
      </ul>
    ),
  },
  {
    icon: "🔒",
    title: "5. Data security",
    body: (
      <ul>
        <li>
          All traffic runs over encrypted HTTPS connections.
        </li>
        <li>
          Authentication is handled by Firebase Authentication; passwords for
          login are never handled by Winggo (login is via Facebook).
        </li>
        <li>
          App databases are protected by access rules — users can only reach
          their own records; sensitive operations (approving KYC, processing
          withdrawals) are admin-only.
        </li>
      </ul>
    ),
  },
  {
    icon: "📤",
    title: "6. Sharing of data",
    body: (
      <ul>
        <li>
          We do <b>not sell</b> your personal data.
        </li>
        <li>
          Data is shared only with the service providers listed above, strictly
          to run the service (e.g. Razorpay to move money, Cloudinary to host
          images).
        </li>
        <li>
          We may disclose data if required by law, regulation, or a valid
          request from law-enforcement authorities.
        </li>
      </ul>
    ),
  },
  {
    icon: "🗑️",
    title: "7. Data retention & deletion",
    body: (
      <>
        <p>
          You can request deletion of your account and personal data at any
          time. There is no automatic deletion — requests are handled manually
          by our support team. Full details of the process are on our{" "}
          <a href="/data-deletion" className="text-yellow-400 underline hover:text-yellow-300">
            User Data Deletion page
          </a>
          .
        </p>
        <p>
          Some financial transaction records may be retained after deletion
          where required for legal, tax or accounting obligations.
        </p>
      </>
    ),
  },
  {
    icon: "👶",
    title: "8. Age restriction",
    body: (
      <p>
        Winggo is a real-money gaming platform. It is intended only for users
        who are 18 years or older and who are legally permitted to play
        real-money games in their jurisdiction. We do not knowingly collect
        data from minors.
      </p>
    ),
  },
  {
    icon: "✉️",
    title: "9. Contact us",
    body: <ContactBlock />,
  },
];

function ContactBlock() {
  const [cfg, setCfg] = useState<SupportConfig>(DEFAULT_SUPPORT_CONFIG);
  useEffect(() => subscribeSupportConfig(setCfg), []);
  return (
    <ul>
      <li>
        Email:{" "}
        <a href={`mailto:${cfg.gmail}`} className="text-yellow-400 underline hover:text-yellow-300">
          {cfg.gmail}
        </a>
      </li>
      <li>
        Instagram:{" "}
        <a href={cfg.instagramUrl} target="_blank" rel="noreferrer" className="text-yellow-400 underline hover:text-yellow-300">
          @{cfg.instagramUsername}
        </a>
      </li>
      <li>{cfg.supportText}</li>
    </ul>
  );
}

export default function PrivacyPolicyScreen() {
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
            🔒
          </div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">Privacy Policy</h1>
          <p className="mt-1 text-sm text-zinc-500">Winggo &middot; Last updated: November 2026</p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.title} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-black text-white sm:text-lg">
                <span>{s.icon}</span>
                {s.title}
              </h2>
              <div className="space-y-3 text-sm leading-relaxed [&_b]:text-zinc-100 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        {/* Cross links */}
        <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center sm:p-5">
          <p className="text-sm text-zinc-300">
            Want your data deleted?{" "}
            <a href="/data-deletion" className="font-bold text-yellow-400 underline hover:text-yellow-300">
              Read the Data Deletion instructions →
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
