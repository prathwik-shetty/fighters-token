import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "rzp_test_samplekey123";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "sample_razorpay_secret_key";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "sample_webhook_secret_for_signature_verification";

/**
 * Creates a Razorpay Order
 */
export async function createRazorpayOrder(params: {
  amountInINR: number;
  receiptId: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string; isMock?: boolean }> {
  const { amountInINR, receiptId, notes = {} } = params;
  const amountInPaise = Math.round(amountInINR * 100);

  // If using sample/placeholder keys, generate a valid mock order for development
  if (RAZORPAY_KEY_ID.includes("sample") || RAZORPAY_KEY_SECRET.includes("sample")) {
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: mockOrderId,
      amount: amountInPaise,
      currency: "INR",
      isMock: true,
    };
  }

  const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
      notes,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay Order creation failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
  };
}

/**
 * Verifies Razorpay payment signature
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { orderId, paymentId, signature } = params;

  // If mock order in development/test
  if (orderId.startsWith("order_mock_") && signature === "mock_signature_approved") {
    return true;
  }

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return expectedSignature === signature;
}

/**
 * Verifies Razorpay Webhook signature
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!signature || !RAZORPAY_WEBHOOK_SECRET) return false;

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
}

/**
 * Initiates an automatic refund via Razorpay API
 */
export async function triggerRazorpayRefund(params: {
  paymentId: string;
  amountInINR?: number; // if omitted, full refund
  reason?: string;
}): Promise<{ id: string; status: string; amount: number; isMock?: boolean }> {
  const { paymentId, amountInINR, reason = "Booking cancelled or refunded by admin" } = params;

  if (paymentId.startsWith("pay_mock_") || RAZORPAY_KEY_SECRET.includes("sample")) {
    return {
      id: `rfnd_mock_${Date.now()}`,
      status: "processed",
      amount: (amountInINR || 1000) * 100,
      isMock: true,
    };
  }

  const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const payload: Record<string, unknown> = {
    notes: { reason },
  };

  if (amountInINR) {
    payload.amount = Math.round(amountInINR * 100);
  }

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay refund failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
  };
}
