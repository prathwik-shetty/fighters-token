import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getCurrentMember();
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    const member = await prisma.member.findUnique({
      where: { id: session.memberId },
      include: {
        heldTokens: {
          where: {
            status: "HELD",
            holdExpiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            tokenNumber: true,
            holdExpiresAt: true,
          },
        },
        bookedTokens: {
          select: {
            id: true,
            tokenNumber: true,
            status: true,
            bookedAt: true,
            bookingId: true,
          },
          orderBy: { tokenNumber: "asc" },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({
      authenticated: true,
      member: {
        id: member.id,
        phone: member.phone,
        countryCode: member.countryCode,
        name: member.name,
        heldTokens: member.heldTokens,
        bookedTokens: member.bookedTokens,
      },
    });
  } catch (error) {
    console.error("auth/me error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
