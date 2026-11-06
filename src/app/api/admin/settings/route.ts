import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

const SettingsSchema = z.object({
  saleId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().optional(),
  pricePerToken: z.number().positive(),
  maxTokensPerMember: z.number().int().min(1).max(20),
  holdDurationSeconds: z.number().int().min(120).max(180),
  payByDeadlineDays: z.number().int().min(1).max(30),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid settings parameters." }, { status: 400 });
    }

    const {
      saleId,
      title,
      description,
      pricePerToken,
      maxTokensPerMember,
      holdDurationSeconds,
      payByDeadlineDays,
    } = parsed.data;

    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        title: title.trim(),
        description: description?.trim(),
        pricePerToken,
        maxTokensPerMember,
        holdDurationSeconds,
        payByDeadlineDays,
      },
    });

    await prisma.adminActionLog.create({
      data: {
        actor: admin.email,
        action: "UPDATE_SETTINGS",
        details: JSON.stringify(parsed.data),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Sale settings updated successfully.",
      sale: updatedSale,
    });
  } catch (error) {
    console.error("settings error:", error);
    return NextResponse.json({ error: "Failed to update settings." }, { status: 500 });
  }
}
