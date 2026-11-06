import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticator } from "otplib";
import prisma from "@/lib/db";
import { getCurrentAdmin, signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

const VerifySchema = z.object({
  totpCode: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const adminSession = await getCurrentAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a 6-digit code." }, { status: 400 });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: adminSession.adminId },
    });

    if (!admin || !admin.totpSecret) {
      return NextResponse.json({ error: "No pending 2FA secret found." }, { status: 400 });
    }

    const isValid = authenticator.check(parsed.data.totpCode.trim(), admin.totpSecret);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Enable TOTP 2FA
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpEnabled: true },
    });

    // Sign fresh session
    const token = await signAdminToken({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      totpVerified: true,
    });

    const response = NextResponse.json({
      success: true,
      message: "Two-factor authentication successfully enabled!",
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("totp verify error:", error);
    return NextResponse.json({ error: "Failed to verify 2FA." }, { status: 500 });
  }
}
