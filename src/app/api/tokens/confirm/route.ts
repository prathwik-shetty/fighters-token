import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentMember } from "@/lib/auth";
import { confirmMemberBooking } from "@/services/token-engine";

const ConfirmSchema = z.object({
  saleId: z.string().uuid(),
  memberName: z.string().min(2, "Full name must be at least 2 characters."),
});

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ error: "Please log in to confirm booking." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid booking confirmation details." },
        { status: 400 }
      );
    }

    const result = await confirmMemberBooking({
      saleId: parsed.data.saleId,
      memberId: member.memberId,
      memberName: parsed.data.memberName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      booking: result.booking,
      message: "Tokens booked successfully! Payments will open once all tokens are booked.",
    });
  } catch (error) {
    console.error("tokens/confirm error:", error);
    return NextResponse.json({ error: "Failed to confirm booking." }, { status: 500 });
  }
}
