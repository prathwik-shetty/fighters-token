import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { adminAssignTokens } from "@/services/token-engine";

const AssignSchema = z.object({
  saleId: z.string().uuid(),
  recipientName: z.string().min(2, "Recipient name must be at least 2 characters."),
  recipientPhone: z.string().optional(),
  count: z.number().int().min(1).max(50),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid assignment data." },
        { status: 400 }
      );
    }

    const result = await adminAssignTokens({
      saleId: parsed.data.saleId,
      recipientName: parsed.data.recipientName,
      recipientPhone: parsed.data.recipientPhone,
      count: parsed.data.count,
      adminActor: admin.email,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${result.assignedCount} tokens to ${result.recipientName}.`,
      assignedTokens: result.assignedTokens,
      recipientName: result.recipientName,
    });
  } catch (error) {
    console.error("admin assign error:", error);
    return NextResponse.json({ error: "Failed to assign tokens." }, { status: 500 });
  }
}
