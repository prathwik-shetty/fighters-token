import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

const FreezeSchema = z.object({
  saleId: z.string().uuid(),
  tokenNumbers: z.array(z.number().int().positive()).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = FreezeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid token numbers." }, { status: 400 });
    }

    const { saleId, tokenNumbers } = parsed.data;

    // Check if any of these tokens are already PAID or BOOKED
    const alreadyBooked = await prisma.token.findMany({
      where: {
        saleId,
        tokenNumber: { in: tokenNumbers },
        status: { in: ["BOOKED", "PAID"] },
      },
      select: { tokenNumber: true, status: true },
    });

    if (alreadyBooked.length > 0) {
      const conflicting = alreadyBooked.map((t) => `#${t.tokenNumber} (${t.status})`).join(", ");
      return NextResponse.json(
        { error: `Cannot freeze tokens that are already booked or paid: ${conflicting}. Please cancel or refund them first.` },
        { status: 400 }
      );
    }

    // Update tokens to FROZEN
    await prisma.token.updateMany({
      where: {
        saleId,
        tokenNumber: { in: tokenNumbers },
      },
      data: {
        status: "FROZEN",
        heldByMemberId: null,
        holdExpiresAt: null,
        version: { increment: 1 },
      },
    });

    // Log admin action
    await prisma.adminActionLog.create({
      data: {
        actor: admin.email,
        action: "FREEZE_TOKENS",
        details: JSON.stringify({ saleId, tokenNumbers: tokenNumbers.sort((a, b) => a - b) }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully froze ${tokenNumbers.length} tokens.`,
      frozenTokens: tokenNumbers,
    });
  } catch (error) {
    console.error("freeze tokens error:", error);
    return NextResponse.json({ error: "Failed to freeze tokens." }, { status: 500 });
  }
}
