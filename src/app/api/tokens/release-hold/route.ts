import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentMember } from "@/lib/auth";
import { releaseHold } from "@/services/token-engine";

const ReleaseSchema = z.object({
  saleId: z.string().uuid(),
  tokenNumber: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ReleaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await releaseHold({
      saleId: parsed.data.saleId,
      tokenNumber: parsed.data.tokenNumber,
      memberId: member.memberId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("tokens/release-hold error:", error);
    return NextResponse.json({ error: "Failed to release hold." }, { status: 500 });
  }
}
