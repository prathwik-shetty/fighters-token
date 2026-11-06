import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";
import { calculateSaleStats } from "@/services/stats";

const TogglePaymentsSchema = z.object({
  saleId: z.string().uuid(),
  open: z.boolean(),
  forceOverride: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = TogglePaymentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment toggle request." }, { status: 400 });
    }

    const { saleId, open, forceOverride } = parsed.data;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { tokens: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    if (open) {
      // Calculate whether all tokens are booked
      const frozenCount = sale.tokens.filter((t) => t.status === "FROZEN").length;
      const availableCount = sale.tokens.filter((t) => t.status === "AVAILABLE").length;
      const heldCount = sale.tokens.filter((t) => t.status === "HELD").length;
      const memberBookedCount = sale.tokens.filter((t) => t.status === "BOOKED" && !t.isAdminAssigned).length;
      const adminAssignedCount = sale.tokens.filter((t) => t.isAdminAssigned).length;
      const paidCount = sale.tokens.filter((t) => t.status === "PAID").length;

      const stats = calculateSaleStats({
        totalTokens: sale.totalTokens,
        pricePerToken: sale.pricePerToken,
        frozenCount,
        availableCount,
        heldCount,
        memberBookedCount,
        adminAssignedCount,
        paidCount,
        refundsCount: 0,
        refundsAmount: 0,
      });

      if (!stats.allTokensBooked && !forceOverride) {
        return NextResponse.json(
          {
            error: "Not all tokens are booked yet.",
            requiresWarningConfirmation: true,
            warning: `Currently ${stats.totalBookedAndAssigned.value} of ${stats.effectiveTokens.value} tokens are booked (${stats.percentageBooked.formattedPercentage}). Are you sure you want to open payments early?`,
            stats,
          },
          { status: 400 }
        );
      }
    }

    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        paymentsOpen: open,
        paymentsOpenedAt: open ? new Date() : null,
      },
    });

    await prisma.adminActionLog.create({
      data: {
        actor: admin.email,
        action: open ? "OPEN_PAYMENTS" : "CLOSE_PAYMENTS",
        details: JSON.stringify({
          saleId,
          forced: Boolean(forceOverride),
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      paymentsOpen: updatedSale.paymentsOpen,
      message: open ? "Payments are now OPEN to all members!" : "Payments are now CLOSED.",
    });
  } catch (error) {
    console.error("toggle payments error:", error);
    return NextResponse.json({ error: "Failed to toggle payments." }, { status: 500 });
  }
}
