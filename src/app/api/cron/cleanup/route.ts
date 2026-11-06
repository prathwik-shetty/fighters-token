import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { releaseExpiredHolds } from "@/services/token-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    // 1. Release expired selection holds (180s)
    const releasedHoldsCount = await releaseExpiredHolds();

    // 2. Process expired payment windows (240s window)
    // Find bookings where payment window has expired and status is PENDING_PAYMENT
    const expiredPaymentBookings = await prisma.booking.findMany({
      where: {
        status: "PENDING_PAYMENT",
        paymentWindowExpiresAt: {
          lte: now,
        },
      },
      include: {
        tokens: true,
      },
    });

    let paymentLocksResetCount = 0;
    for (const booking of expiredPaymentBookings) {
      // Check if checkout is actively open and heartbeat was within the last 45s:
      const hasRecentHeartbeat =
        booking.paymentCheckoutActive &&
        booking.lastPaymentHeartbeat &&
        now.getTime() - booking.lastPaymentHeartbeat.getTime() < 45000;

      if (hasRecentHeartbeat && !booking.paymentGraceExtended) {
        // Apply 600s grace extension once per payment attempt!
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentWindowExpiresAt: new Date(now.getTime() + 600 * 1000),
            paymentGraceExtended: true,
          },
        });
        continue;
      }

      // If user has left the page (no recent heartbeat) or grace was already exhausted:
      // Reset checkout lock so member can re-attempt from "My Tokens"
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentCheckoutActive: false,
          paymentWindowExpiresAt: null,
        },
      });
      paymentLocksResetCount++;
    }

    return NextResponse.json({
      success: true,
      releasedHoldsCount,
      paymentLocksResetCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("cleanup cron error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
