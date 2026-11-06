import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid && process.env.NODE_ENV === "production") {
      console.error("Razorpay webhook signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload?.payment?.entity || event.payload?.order?.entity;

    if (!payload) {
      return NextResponse.json({ status: "ignored" });
    }

    if (eventType === "payment.captured" || eventType === "order.paid") {
      const orderId = payload.order_id || payload.id;
      const paymentId = payload.id;

      const booking = await prisma.booking.findFirst({
        where: { razorpayOrderId: orderId },
        include: { tokens: true, sale: true },
      });

      if (booking && booking.status !== "PAID") {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "PAID",
              razorpayPaymentId: paymentId,
              paidAt: new Date(),
              paymentCheckoutActive: false,
            },
          });

          await tx.token.updateMany({
            where: { bookingId: booking.id },
            data: {
              status: "PAID",
              version: { increment: 1 },
            },
          });

          await tx.payment.upsert({
            where: { razorpayPaymentId: paymentId },
            update: { status: "CAPTURED" },
            create: {
              bookingId: booking.id,
              saleId: booking.saleId,
              memberId: booking.memberId,
              amount: booking.totalAmount,
              currency: booking.sale.currency,
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId,
              status: "CAPTURED",
              method: payload.method || null,
            },
          });
        });
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Razorpay webhook handler error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
