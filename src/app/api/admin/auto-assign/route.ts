import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";
import { checkAndExecuteAutoAssignment } from "@/services/token-engine";

const AutoAssignConfigSchema = z.object({
  saleId: z.string().uuid(),
  thresholdPercent: z.number().min(1).max(99).default(10.0),
  kTokens: z.number().int().min(1).max(20).default(1),
  targetName: z.string().min(2),
  triggerNow: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = AutoAssignConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid auto-assign configuration." }, { status: 400 });
    }

    const { saleId, thresholdPercent, kTokens, targetName, triggerNow } = parsed.data;

    // Update sale configuration
    await prisma.sale.update({
      where: { id: saleId },
      data: {
        autoAssignThresholdPercent: thresholdPercent,
        autoAssignKTokens: kTokens,
        autoAssignTargetName: targetName.trim(),
        autoAssignExecuted: false, // reset trigger
      },
    });

    await prisma.adminActionLog.create({
      data: {
        actor: admin.email,
        action: "CONFIG_AUTO_ASSIGN_RULE",
        details: JSON.stringify({ saleId, thresholdPercent, kTokens, targetName }),
      },
    });

    // If triggerNow is true or threshold already met:
    let triggeredResult = null;
    if (triggerNow) {
      triggeredResult = await checkAndExecuteAutoAssignment(saleId);
    }

    return NextResponse.json({
      success: true,
      message: "Auto-assignment rule configured successfully.",
      rule: {
        thresholdPercent,
        kTokens,
        targetName,
      },
      triggeredResult,
    });
  } catch (error) {
    console.error("auto-assign route error:", error);
    return NextResponse.json({ error: "Failed to configure auto-assignment rule." }, { status: 500 });
  }
}
