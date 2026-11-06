import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentMember } from "@/lib/auth";
import { holdToken } from "@/services/token-engine";

const HoldSchema = z.object({
  saleId: z.string().uuid(),
  tokenNumber: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json(
        { error: "Please log in with your WhatsApp number to select tokens." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = HoldSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid token selection request." }, { status: 400 });
    }

    const result = await holdToken({
      saleId: parsed.data.saleId,
      tokenNumber: parsed.data.tokenNumber,
      memberId: member.memberId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      token: result.token,
    });
  } catch (error) {
    console.error("tokens/hold error:", error);
    return NextResponse.json({ error: "Failed to hold token." }, { status: 500 });
  }
}
