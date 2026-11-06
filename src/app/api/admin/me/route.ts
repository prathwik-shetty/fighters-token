import { NextResponse } from "next/server";
import { getCurrentAdmin, ADMIN_COOKIE_NAME } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const session = await getCurrentAdmin();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: session.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        totpEnabled: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      admin,
    });
  } catch (error) {
    console.error("admin me error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
