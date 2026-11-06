import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

const SetCountSchema = z.object({
  saleId: z.string().uuid(),
  newCount: z.number().int().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = SetCountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid count (1-1000)." }, { status: 400 });
    }

    const { saleId, newCount } = parsed.data;

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        tokens: {
          orderBy: { tokenNumber: "asc" },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const currentCount = sale.tokens.length;

    if (newCount === currentCount) {
      return NextResponse.json({ success: true, message: "Token count is unchanged." });
    }

    if (newCount > currentCount) {
      // Add additional tokens from (currentCount + 1) to newCount
      const toAdd = [];
      for (let num = currentCount + 1; num <= newCount; num++) {
        toAdd.push({
          saleId,
          tokenNumber: num,
          status: "AVAILABLE" as const,
          isAdminAssigned: false,
          version: 0,
        });
      }

      await prisma.token.createMany({ data: toAdd });
      await prisma.sale.update({
        where: { id: saleId },
        data: { totalTokens: newCount },
      });

      await prisma.adminActionLog.create({
        data: {
          actor: admin.email,
          action: "SET_TOKEN_COUNT_INCREASE",
          details: JSON.stringify({ saleId, oldCount: currentCount, newCount, added: toAdd.length }),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully increased token count from ${currentCount} to ${newCount}.`,
        newCount,
      });
    } else {
      // Reducing count: check if any tokens between (newCount + 1) and currentCount are booked/paid!
      const occupiedInShrinkRange = await prisma.token.findMany({
        where: {
          saleId,
          tokenNumber: { gt: newCount },
          status: { in: ["BOOKED", "PAID"] },
        },
        select: { tokenNumber: true, status: true },
      });

      if (occupiedInShrinkRange.length > 0) {
        const tokensList = occupiedInShrinkRange.map((t) => `#${t.tokenNumber}`).join(", ");
        return NextResponse.json(
          {
            error: `Cannot reduce token count to ${newCount}: tokens ${tokensList} are already booked or paid. You can only remove unbooked tokens.`,
          },
          { status: 400 }
        );
      }

      // Safe to remove unbooked tokens in that range
      await prisma.token.deleteMany({
        where: {
          saleId,
          tokenNumber: { gt: newCount },
        },
      });

      await prisma.sale.update({
        where: { id: saleId },
        data: { totalTokens: newCount },
      });

      await prisma.adminActionLog.create({
        data: {
          actor: admin.email,
          action: "SET_TOKEN_COUNT_DECREASE",
          details: JSON.stringify({ saleId, oldCount: currentCount, newCount, removed: currentCount - newCount }),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully reduced token count from ${currentCount} to ${newCount}.`,
        newCount,
      });
    }
  } catch (error) {
    console.error("set-count error:", error);
    return NextResponse.json({ error: "Failed to update token count." }, { status: 500 });
  }
}
