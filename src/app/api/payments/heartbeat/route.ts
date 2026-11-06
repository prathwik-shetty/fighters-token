import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";

const HeartbeatSchema = z.object({
  bookingId: z.string().uuid(),
  checkoutOpen: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = HeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid heartbeat payload." }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
    });

    if (!booking || booking.memberId !== member.memberId) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const now = new Date();
    let updatedExpiresAt = booking.paymentWindowExpiresAt;
    let graceApplied = false;

    // If checkout is open and window is close to expiring (or expired within 30s) and grace hasn't been extended yet:
    if (
      parsed.data.checkoutOpen &&
      !booking.paymentGraceExtended &&
      booking.paymentWindowExpiresAt
    ) {
      const remainingMs = booking.paymentWindowExpiresAt.getTime() - now.getTime();
      // If less than 60 seconds remaining or just expired
      if (remainingMs <= 60000) {
        // Extend by 600 seconds (10 minutes) once per payment attempt
        updatedExpiresAt = new Date(now.getTime() + 600 * 1000);
        graceApplied = true;
      }
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentCheckoutActive: parsed.data.checkoutOpen,
        lastPaymentHeartbeat: now,
        paymentWindowExpiresAt: updatedExpiresAt,
        paymentGraceExtended: graceApplied ? true : booking.paymentGraceExtended,
      },
    });

    return NextResponse.json({
      success: true,
      paymentWindowExpiresAt: updatedExpiresAt?.toISOString(),
      graceApplied,
    });
  } catch (error) {
    console.error("payment heartbeat error:", error);
    return NextResponse.json({ error: "Heartbeat failed." }, { status: 500 });
  }
}
