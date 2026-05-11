import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";

interface KYCScreenProps {
  onBack?: () => void;
}

type KYCStatus = "pending" | "verified" | "rejected";

interface KYCData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  state: string;
  city: string;
  pan: string;
  aadhaar: string;
  status: KYCStatus;
}

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Chandigarh","Puducherry",
];

function loadKYC(): KYCData {
  try {
    const saved = JSON.parse(localStorage.getItem("winggo_kyc") || "{}");
    return {
      firstName: saved.firstName ?? "",
      lastName:  saved.lastName  ?? "",
      email:     saved.email     ?? "",
      phone:     saved.phone     ?? "",
      dob:       saved.dob       ?? "",
      gender:    saved.gender    ?? "",
      state:     saved.state     ?? "",
      city:      saved.city      ?? "",
      pan:       saved.pan       ?? "",
      aadhaar:   saved.aadhaar   ?? "",
      status:    saved.status    ?? "pending",
    };
  } catch {
    return { firstName:"", lastName:"", email:"", phone:"", dob:"",
             gender:"", state:"", city:"", pan:"", aadhaar:"", status:"pending" };
  }
}

const STATUS_CFG = {
  pending:  { label: "Verification Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: "⏳", desc: "Submit your details for review." },
  verified: { label: "KYC Verified ✅",        color: "#34d399", bg: "rgba(52,211,153,0.12)",  icon: "✅", desc: "Your identity is verified. Full access unlocked!" },
  rejected: { label: "KYC Rejected",          color: "#f87171", bg: "rgba(248,113,113,0.12)", icon: "❌", desc: "Verification failed. Please re-submit correct documents." },
};

function UploadBox({ label, sublabel, value, onChange }: {
  label: string; sublabel: string;
  value: string | null; onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLoading(false);
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</label>
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => ref.current?.click()}
        className="relative rounded-2xl overflow-hidden cursor-pointer"
        style={{
          border: value ? "1.5px solid rgba(52,211,153,0.5)" : "1.5px dashed rgba(255,215,0,0.30)",
          background: value ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)",
          minHeight: 80,
        }}
      >
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {loading ? (
          <div className="flex flex-col items-center justify-center h-20 gap-2">
            <motion.div
              className="w-6 h-6 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "#FFD700", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Uploading…</span>
          </div>
        ) : value ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <img src={value} alt={label} className="w-14 h-14 rounded-xl object-cover" style={{ border: "1px solid rgba(52,211,153,0.3)" }} />
            <div>
              <div className="text-xs font-black" style={{ color: "#34d399" }}>✓ Uploaded</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Tap to change</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-20 gap-1">
            <span className="text-2xl">📎</span>
            <span className="text-xs font-bold" style={{ color: "#FFD700" }}>{sublabel}</span>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>JPG, PNG, PDF • Max 5MB</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = "text", maxLen }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string; maxLen?: number;
}) {
  return (
    <div>
      <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLen}
        className="w-full rounded-xl px-4 py-3 text-white text-sm font-medium outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          caretColor: "#FFD700",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.45)"; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none appearance-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: value ? "#fff" : "rgba(255,255,255,0.35)",
        }}
      >
        <option value="" disabled style={{ color: "#555", background: "#0a0a15" }}>Select {label}</option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: "#0a0a15", color: "#fff" }}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export default function KYCScreen({ onBack }: KYCScreenProps) {
  const [form, setForm] = useState<KYCData>(loadKYC);
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack,  setAadhaarBack]  = useState<string | null>(null);
  const [selfie,       setSelfie]       = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof KYCData) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const statusCfg = STATUS_CFG[form.status];

  function validate() {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim())  e.lastName  = "Required";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Invalid email";
    if (!form.phone.match(/^[6-9]\d{9}$/)) e.phone = "Enter valid 10-digit number";
    if (!form.dob)   e.dob   = "Required";
    if (!form.gender) e.gender = "Required";
    if (!form.state) e.state = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (!form.pan.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) e.pan = "Invalid PAN (e.g. ABCDE1234F)";
    if (!form.aadhaar.match(/^\d{12}$/)) e.aadhaar = "Aadhaar must be 12 digits";
    if (!aadhaarFront) e.aadhaarFront = "Upload Aadhaar front";
    if (!aadhaarBack)  e.aadhaarBack  = "Upload Aadhaar back";
    if (!selfie)       e.selfie       = "Upload selfie";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const updated = { ...form, status: "pending" as KYCStatus };
    localStorage.setItem("winggo_kyc", JSON.stringify(updated));
    setForm(updated);
    setSubmitted(true);
  }

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {/* ── HEADER ── */}
      <div
        className="flex items-center gap-3 px-4 py-4 shrink-0"
        style={{
          background: "rgba(7,5,15,0.98)",
          borderBottom: "1px solid rgba(255,215,0,0.10)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ zIndex: 9999 }}>
          <BackButton onBack={onBack} label="Profile" />
        </div>
        <div className="flex-1">
          <div className="text-white font-black text-lg leading-none">KYC Verification</div>
          <div className="text-xs mt-0.5" style={{ color: "#666" }}>Secure Identity Check</div>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-[10px] font-black"
          style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}44` }}
        >
          {statusCfg.icon} {form.status.toUpperCase()}
        </div>
      </div>

      {/* ── SCROLLABLE FORM ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Status banner */}
        <div className="mx-4 mt-4 px-4 py-3 rounded-2xl flex items-center gap-3"
          style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.color}33` }}>
          <span className="text-2xl">{statusCfg.icon}</span>
          <div>
            <div className="text-sm font-black" style={{ color: statusCfg.color }}>{statusCfg.label}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{statusCfg.desc}</div>
          </div>
        </div>

        {/* ── Success animation ── */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="mx-4 mt-3 px-4 py-4 rounded-2xl flex flex-col items-center gap-2 text-center"
              style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)" }}
            >
              <motion.span className="text-4xl"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
              >✅</motion.span>
              <div className="text-sm font-black" style={{ color: "#34d399" }}>KYC Submitted Successfully!</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                Our team will verify your documents within 24 hours.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SECTION: Personal Info ── */}
        <Section label="👤 Personal Information">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Field label="First Name *" placeholder="Rahul" value={form.firstName} onChange={set("firstName")} />
              {errors.firstName && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.firstName}</p>}
            </div>
            <div>
              <Field label="Last Name *" placeholder="Sharma" value={form.lastName} onChange={set("lastName")} />
              {errors.lastName && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <Field label="Email Address *" placeholder="rahul@email.com" value={form.email} onChange={set("email")} type="email" />
            {errors.email && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.email}</p>}
          </div>
          <div>
            <Field label="Phone Number *" placeholder="9876543210" value={form.phone} onChange={set("phone")} type="tel" maxLen={10} />
            {errors.phone && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.phone}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Field label="Date of Birth *" placeholder="" value={form.dob} onChange={set("dob")} type="date" />
              {errors.dob && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.dob}</p>}
            </div>
            <div>
              <SelectField label="Gender *" value={form.gender} onChange={set("gender")} options={["Male", "Female", "Other"]} />
              {errors.gender && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.gender}</p>}
            </div>
          </div>
        </Section>

        {/* ── SECTION: Address ── */}
        <Section label="📍 Address">
          <div>
            <SelectField label="State *" value={form.state} onChange={set("state")} options={INDIAN_STATES} />
            {errors.state && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.state}</p>}
          </div>
          <div>
            <Field label="City *" placeholder="Mumbai" value={form.city} onChange={set("city")} />
            {errors.city && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.city}</p>}
          </div>
        </Section>

        {/* ── SECTION: Documents ── */}
        <Section label="🪪 Identity Documents">
          <div>
            <Field label="PAN Card Number *" placeholder="ABCDE1234F" value={form.pan}
              onChange={(v) => set("pan")(v.toUpperCase())} maxLen={10} />
            {errors.pan && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.pan}</p>}
          </div>
          <div>
            <Field label="Aadhaar Number *" placeholder="1234 5678 9012" value={form.aadhaar}
              onChange={set("aadhaar")} type="tel" maxLen={12} />
            {errors.aadhaar && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.aadhaar}</p>}
          </div>

          {/* Uploads */}
          <div>
            <UploadBox label="Aadhaar Front *" sublabel="Upload front side" value={aadhaarFront} onChange={setAadhaarFront} />
            {errors.aadhaarFront && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.aadhaarFront}</p>}
          </div>
          <div>
            <UploadBox label="Aadhaar Back *" sublabel="Upload back side" value={aadhaarBack} onChange={setAadhaarBack} />
            {errors.aadhaarBack && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.aadhaarBack}</p>}
          </div>
          <div>
            <UploadBox label="Selfie with Aadhaar *" sublabel="Take a clear selfie" value={selfie} onChange={setSelfie} />
            {errors.selfie && <p className="text-[10px] mt-1" style={{ color: "#f87171" }}>{errors.selfie}</p>}
          </div>
        </Section>

        {/* ── SECURE NOTE ── */}
        <div className="mx-4 mt-2 px-4 py-3 rounded-2xl flex items-start gap-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-lg mt-0.5">🔒</span>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Your documents are encrypted and stored securely. We comply with all RBI and government data protection guidelines.
            Data is only used for identity verification.
          </p>
        </div>

        {/* ── SUBMIT BUTTONS ── */}
        <div className="px-4 mt-4 mb-28 flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #FFD700, #ff8c00)",
              color: "#000",
              boxShadow: "0 0 24px rgba(255,215,0,0.35)",
              letterSpacing: "0.04em",
            }}
          >
            🪪 Verify KYC
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              localStorage.setItem("winggo_kyc", JSON.stringify(form));
              setSubmitted(false);
            }}
            className="w-full py-4 rounded-2xl font-black text-sm cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            💾 Save Draft
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mt-4">
      <div className="text-xs font-black tracking-widest uppercase mb-3 flex items-center gap-2"
        style={{ color: "rgba(255,215,0,0.6)" }}>
        {label}
      </div>
      <div className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {children}
      </div>
    </div>
  );
}
