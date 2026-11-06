import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { createRazorpayOrder } from "@/lib/razorpay";

const CreateOrderSchema = z.object({
  bookingId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ error: "Please log in to make a payment." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid booking ID." }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      include: {
        sale: true,
        tokens: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking record not found." }, { status: 404 });
    }

    if (booking.memberId !== member.memberId) {
      return NextResponse.json({ error: "Access denied to this booking." }, { status: 403 });
    }

    if (booking.status === "PAID") {
      return NextResponse.json({ error: "This booking is already paid and confirmed." }, { status: 400 });
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "This booking has been cancelled." }, { status: 400 });
    }

    // CRITICAL BUSINESS RULE: Payment Gating
    // Payments are DISABLED until admin unlocks them!
    if (!booking.sale.paymentsOpen) {
      return NextResponse.json(
        {
          error: "Payments are currently disabled. Payment opens once all tokens are booked or when unlocked by the admin.",
          paymentsGated: true,
        },
        { status: 403 }
      );
    }

    // Payment window rule: 240 seconds lock window from checkout initiation
    const paymentWindowExpiresAt = new Date(Date.now() + 240 * 1000); // 240 seconds

    // Create Razorpay order
    const order = await createRazorpayOrder({
      amountInINR: booking.totalAmount,
      receiptId: `rcpt_${booking.id.slice(0, 8)}`,
      notes: {
        bookingId: booking.id,
        memberPhone: booking.memberPhone,
        tokenCount: booking.tokenCount.toString(),
        tokens: booking.tokens.map((t) => t.tokenNumber).join(","),
      },
    });

    // Update booking with order and 240s window
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        razorpayOrderId: order.id,
        paymentWindowExpiresAt,
        paymentCheckoutActive: true,
        lastPaymentHeartbeat: new Date(),
        paymentGraceExtended: false, // reset grace extension flag for new attempt
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_samplekey123",
      bookingId: booking.id,
      memberName: booking.memberName,
      memberPhone: booking.memberPhone,
      totalAmount: booking.totalAmount,
      paymentWindowExpiresAt: paymentWindowExpiresAt.toISOString(),
      tokenNumbers: booking.tokens.map((t) => t.tokenNumber),
      isMock: order.isMock,
    });
  } catch (error) {
    console.error("create-order error:", error);
    return NextResponse.json({ error: "Failed to initialize payment order." }, { status: 500 });
  }
}
