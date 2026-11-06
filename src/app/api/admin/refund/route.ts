import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";
import { triggerRazorpayRefund } from "@/lib/razorpay";

const RefundSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = RefundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid refund reason." }, { status: 400 });
    }

    const { bookingId, reason } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: { where: { status: "CAPTURED" }, orderBy: { createdAt: "desc" } },
        tokens: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.status !== "PAID" || booking.payments.length === 0) {
      return NextResponse.json({ error: "Only paid bookings can be refunded." }, { status: 400 });
    }

    const payment = booking.payments[0];

    // Trigger Razorpay refund via API
    const refundResult = await triggerRazorpayRefund({
      paymentId: payment.razorpayPaymentId,
      amountInINR: booking.totalAmount,
      reason,
    });

    // Atomic update
    await prisma.$transaction(async (tx) => {
      // Create Refund record
      await tx.refund.create({
        data: {
          paymentId: payment.id,
          bookingId: booking.id,
          amount: booking.totalAmount,
          razorpayRefundId: refundResult.id,
          status: "PROCESSED",
          reason,
          initiatedBy: admin.email,
        },
      });

      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      });

      // Update booking
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      // Release tokens back to AVAILABLE
      await tx.token.updateMany({
        where: { bookingId: booking.id },
        data: {
          status: "AVAILABLE",
          bookedByMemberId: null,
          bookedAt: null,
          bookingId: null,
          version: { increment: 1 },
        },
      });

      // Log admin audit action
      await tx.adminActionLog.create({
        data: {
          actor: admin.email,
          action: "PROCESS_REFUND",
          details: JSON.stringify({
            bookingId: booking.id,
            paymentId: payment.razorpayPaymentId,
            refundId: refundResult.id,
            amount: booking.totalAmount,
            reason,
            tokenNumbers: booking.tokens.map((t) => t.tokenNumber),
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Refund of ₹${booking.totalAmount.toLocaleString("en-IN")} successfully processed. Tokens have been released back to Available.`,
      refundId: refundResult.id,
    });
  } catch (error) {
    console.error("refund error:", error);
    return NextResponse.json({ error: "Failed to process refund." }, { status: 500 });
  }
}
