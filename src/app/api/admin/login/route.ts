import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import prisma from "@/lib/db";
import { signAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totpCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AdminLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials format." }, { status: 400 });
    }

    const { email, password, totpCode } = parsed.data;

    let admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // If no admin exists in DB yet, auto-seed the initial admin from environment
    if (!admin && email.toLowerCase().trim() === (process.env.ADMIN_INITIAL_EMAIL || "admin@fighterstoken.com").toLowerCase()) {
      const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || "AdminFighters@2026!";
      const hash = await bcrypt.hash(defaultPassword, 10);
      admin = await prisma.adminUser.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash: hash,
          role: "SUPER_ADMIN",
          totpEnabled: false,
        },
      });
    }

    if (!admin) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // 2FA Check:
    if (admin.totpEnabled && admin.totpSecret) {
      if (!totpCode) {
        return NextResponse.json({
          requiresTotp: true,
          message: "Please enter your 6-digit 2FA authenticator code.",
        });
      }

      const isTotpValid = authenticator.check(totpCode.trim(), admin.totpSecret);
      if (!isTotpValid) {
        return NextResponse.json({ error: "Invalid 2FA code. Please check your authenticator app." }, { status: 401 });
      }
    }

    // Sign admin JWT session
    const token = await signAdminToken({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      totpVerified: admin.totpEnabled ? true : true, // If TOTP not enabled, flag allows setup
    });

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        totpEnabled: admin.totpEnabled,
      },
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    // Record login audit log
    await prisma.adminActionLog.create({
      data: {
        actor: admin.email,
        action: "ADMIN_LOGIN",
        details: JSON.stringify({ ip: req.headers.get("x-forwarded-for") || "unknown" }),
      },
    });

    return response;
  } catch (error) {
    console.error("admin login error:", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
