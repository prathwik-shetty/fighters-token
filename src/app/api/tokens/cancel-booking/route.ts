import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentMember } from "@/lib/auth";
import { cancelUnpaidToken } from "@/services/token-engine";

const CancelSchema = z.object({
  saleId: z.string().uuid(),
  tokenId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = CancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid cancellation request." }, { status: 400 });
    }

    const result = await cancelUnpaidToken({
      saleId: parsed.data.saleId,
      tokenId: parsed.data.tokenId,
      memberId: member.memberId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Token cancelled and returned to available." });
  } catch (error) {
    console.error("tokens/cancel-booking error:", error);
    return NextResponse.json({ error: "Failed to cancel booking." }, { status: 500 });
  }
}
