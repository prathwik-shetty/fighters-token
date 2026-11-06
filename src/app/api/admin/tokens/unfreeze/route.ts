import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

const UnfreezeSchema = z.object({
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
    const parsed = UnfreezeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid token numbers." }, { status: 400 });
    }

    const { saleId, tokenNumbers } = parsed.data;

    await prisma.token.updateMany({
      where: {
        saleId,
        tokenNumber: { in: tokenNumbers },
        status: "FROZEN",
      },
      data: {
        status: "AVAILABLE",
        version: { increment: 1 },
      },
    });

    await prisma.adminActionLog.create({
      data: {
        actor: admin.email,
        action: "UNFREEZE_TOKENS",
        details: JSON.stringify({ saleId, tokenNumbers: tokenNumbers.sort((a, b) => a - b) }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully unfroze ${tokenNumbers.length} tokens.`,
      unfrozenTokens: tokenNumbers,
    });
  } catch (error) {
    console.error("unfreeze error:", error);
    return NextResponse.json({ error: "Failed to unfreeze tokens." }, { status: 500 });
  }
}
