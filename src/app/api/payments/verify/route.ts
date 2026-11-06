import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { verifyRazorpaySignature } from "@/lib/razorpay";

const VerifyPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = VerifyPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment verification parameters." }, { status: 400 });
    }

    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

    // 1. Fetch booking record
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tokens: true,
        sale: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.memberId !== member.memberId) {
      return NextResponse.json({ error: "Access denied to booking." }, { status: 403 });
    }

    if (booking.status === "PAID") {
      return NextResponse.json({ success: true, message: "Booking is already paid and confirmed." });
    }

    // 2. Cryptographic signature verification - NEVER trust client blindly
    const isValidSignature = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValidSignature) {
      console.error(`Invalid payment signature received for booking ${bookingId}`);
      return NextResponse.json({ error: "Payment verification failed. Invalid signature." }, { status: 400 });
    }

    // 3. Mark tokens and booking as PAID in atomic transaction
    await prisma.$transaction(async (tx) => {
      // Update booking
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "PAID",
          razorpayOrderId,
          razorpayPaymentId,
          paidAt: new Date(),
          paymentCheckoutActive: false,
        },
      });

      // Update all associated tokens
      await tx.token.updateMany({
        where: { bookingId },
        data: {
          status: "PAID",
          version: { increment: 1 },
        },
      });

      // Record Payment
      await tx.payment.create({
        data: {
          bookingId,
          saleId: booking.saleId,
          memberId: booking.memberId,
          amount: booking.totalAmount,
          currency: booking.sale.currency,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          status: "CAPTURED",
        },
      });
    });

    const tokenNumbers = booking.tokens.map((t) => t.tokenNumber).sort((a, b) => a - b);

    return NextResponse.json({
      success: true,
      message: `Payment verified successfully! Tokens #${tokenNumbers.join(", #")} confirmed.`,
      tokenNumbers,
      amount: booking.totalAmount,
      bookingId: booking.id,
      razorpayPaymentId,
    });
  } catch (error) {
    console.error("verify payment error:", error);
    return NextResponse.json({ error: "Payment processing failed." }, { status: 500 });
  }
}
