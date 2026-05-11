/**
 * Razorpay Payment Routes — WINGGO
 *
 * POST /api/payment/create-order
 *   → Creates a Razorpay order (server-side) and returns order_id + key_id
 *
 * POST /api/payment/verify
 *   → Verifies HMAC-SHA256 signature to confirm payment genuinely came from
 *     Razorpay. This prevents fake success callbacks from the client.
 *     Returns { success: true } only when signature matches.
 *
 * Security:
 *   - RAZORPAY_KEY_SECRET never leaves the server
 *   - Client receives only key_id (public) and order_id
 *   - Signature verification uses crypto.createHmac (Node built-in, no deps)
 */
import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";

const router = Router();

const KEY_ID     = process.env["RAZORPAY_KEY_ID"]     ?? "";
const KEY_SECRET = process.env["RAZORPAY_KEY_SECRET"] ?? "";

let rzp: Razorpay | null = null;

function getRzp(): Razorpay {
  if (!rzp) {
    if (!KEY_ID || !KEY_SECRET) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars are required");
    }
    rzp = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
  }
  return rzp;
}

// ── POST /api/payment/create-order ─────────────────────────────────────────
router.post("/create-order", async (req, res) => {
  try {
    const { amount, uid, email } = req.body as {
      amount: number;
      uid: string;
      email: string;
    };

    if (!amount || amount < 10) {
      res.status(400).json({ error: "Minimum deposit is ₹10" });
      return;
    }
    if (!uid) {
      res.status(400).json({ error: "uid is required" });
      return;
    }

    const order = await getRzp().orders.create({
      amount: Math.round(amount * 100), // Razorpay uses paise
      currency: "INR",
      receipt: `winggo_${uid.slice(-8)}_${Date.now()}`,
      notes: {
        uid,
        email: email ?? "",
        app: "WINGGO",
      },
    });

    res.json({
      order_id:  order.id,
      amount:    order.amount,
      currency:  order.currency,
      key_id:    KEY_ID,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order creation failed";
    req.log.error({ err }, "Razorpay create-order failed");
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/payment/verify ────────────────────────────────────────────────
router.post("/verify", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ success: false, error: "Missing payment fields" });
      return;
    }

    const body    = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expected !== razorpay_signature) {
      req.log.warn({ razorpay_order_id }, "Razorpay signature mismatch — possible fake payment");
      res.status(400).json({ success: false, error: "Invalid payment signature" });
      return;
    }

    req.log.info({ razorpay_order_id, razorpay_payment_id }, "Payment verified OK");
    res.json({ success: true, payment_id: razorpay_payment_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    req.log.error({ err }, "Razorpay verify failed");
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
