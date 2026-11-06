import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";
import { releaseExpiredHolds } from "@/services/token-engine";
import { calculateSaleStats } from "@/services/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const memberSession = await getCurrentMember();

    // 1. Get or create active sale
    const existingSale = await prisma.sale.findFirst({
      where: { isLive: true },
    });

    const sale =
      existingSale ??
      (await prisma.sale.create({
        data: {
          title: "Fighters Token Sale 2026",
          description: "Annual token booking sale for Fighters community",
          totalTokens: 80,
          pricePerToken: 1000,
          currency: "INR",
          isLive: true,
          paymentsOpen: false,
          maxTokensPerMember: 5,
          holdDurationSeconds: 180,
          payByDeadlineDays: 7,
          autoAssignThresholdPercent: 10.0,
          autoAssignKTokens: 1,
        },
      }));

    if (!existingSale) {
      // Seed tokens 1..80
      const tokenData = Array.from({ length: 80 }, (_, i) => ({
        saleId: sale.id,
        tokenNumber: i + 1,
        status: "AVAILABLE" as const,
        isAdminAssigned: false,
        version: 0,
      }));
      await prisma.token.createMany({ data: tokenData, skipDuplicates: true });
    }

    // 2. Clean up any expired holds before querying
    await releaseExpiredHolds(sale.id);

    // 3. Query all tokens for the sale
    const tokens = await prisma.token.findMany({
      where: { saleId: sale.id },
      orderBy: { tokenNumber: "asc" },
      select: {
        id: true,
        tokenNumber: true,
        status: true,
        isAdminAssigned: true,
        adminAssignedName: true,
        heldByMemberId: true,
        holdExpiresAt: true,
        bookedByMemberId: true,
        bookedAt: true,
        bookingId: true,
      },
    });

    // 4. Calculate live stats
    const frozenCount = tokens.filter((t) => t.status === "FROZEN").length;
    const availableCount = tokens.filter((t) => t.status === "AVAILABLE").length;
    const heldCount = tokens.filter((t) => t.status === "HELD").length;
    const memberBookedCount = tokens.filter((t) => t.status === "BOOKED" && !t.isAdminAssigned).length;
    const adminAssignedCount = tokens.filter((t) => t.isAdminAssigned).length;
    const paidCount = tokens.filter((t) => t.status === "PAID").length;

    // Get refund totals
    const refundAgg = await prisma.refund.aggregate({
      where: { booking: { saleId: sale.id } },
      _count: { id: true },
      _sum: { amount: true },
    });

    const stats = calculateSaleStats({
      totalTokens: sale.totalTokens,
      pricePerToken: sale.pricePerToken,
      frozenCount,
      availableCount,
      heldCount,
      memberBookedCount,
      adminAssignedCount,
      paidCount,
      refundsCount: refundAgg._count.id || 0,
      refundsAmount: refundAgg._sum.amount || 0,
      thresholdPercentage: sale.autoAssignThresholdPercent || 10.0,
    });

    // 5. Transform tokens for client view
    const currentMemberId = memberSession?.memberId || null;
    const formattedTokens = tokens.map((t) => {
      const isHeldByMe = Boolean(currentMemberId && t.heldByMemberId === currentMemberId && t.status === "HELD");
      const isBookedByMe = Boolean(currentMemberId && t.bookedByMemberId === currentMemberId);

      return {
        id: t.id,
        tokenNumber: t.tokenNumber,
        status: t.status,
        isAdminAssigned: t.isAdminAssigned,
        adminAssignedName: t.isAdminAssigned ? t.adminAssignedName : undefined,
        isHeldByMe,
        isBookedByMe,
        holdExpiresAt: isHeldByMe ? t.holdExpiresAt?.toISOString() : null,
      };
    });

    return NextResponse.json({
      sale: {
        id: sale.id,
        title: sale.title,
        description: sale.description,
        totalTokens: sale.totalTokens,
        pricePerToken: sale.pricePerToken,
        currency: sale.currency,
        paymentsOpen: sale.paymentsOpen,
        maxTokensPerMember: sale.maxTokensPerMember,
        holdDurationSeconds: sale.holdDurationSeconds,
      },
      tokens: formattedTokens,
      stats,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("tokens api error:", error);
    return NextResponse.json({ error: "Failed to fetch tokens." }, { status: 500 });
  }
}
