import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { normalizePhoneNumber, verifyOtp } from "@/lib/otp";
import { signMemberToken, MEMBER_COOKIE_NAME } from "@/lib/auth";

const VerifyOtpSchema = z.object({
  phone: z.string().min(5),
  countryCode: z.enum(["+91", "+971"]).default("+91"),
  otp: z.string().length(6),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VerifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid 6-digit OTP." }, { status: 400 });
    }

    const normalized = normalizePhoneNumber(parsed.data.phone, parsed.data.countryCode);
    if (!normalized.isValid) {
      return NextResponse.json({ error: normalized.error || "Invalid phone number." }, { status: 400 });
    }

    const verifyResult = await verifyOtp(normalized.e164, parsed.data.otp);
    if (!verifyResult.valid) {
      return NextResponse.json({ error: verifyResult.error || "Invalid OTP code." }, { status: 400 });
    }

    // Find or create member record
    let member = await prisma.member.findUnique({
      where: { phone: normalized.e164 },
    });

    if (!member) {
      member = await prisma.member.create({
        data: {
          phone: normalized.e164,
          countryCode: parsed.data.countryCode,
          name: parsed.data.name?.trim() || null,
        },
      });
    } else if (parsed.data.name?.trim() && !member.name) {
      member = await prisma.member.update({
        where: { id: member.id },
        data: { name: parsed.data.name.trim() },
      });
    }

    // Create session JWT
    const token = await signMemberToken({
      memberId: member.id,
      phone: member.phone,
      countryCode: member.countryCode,
      name: member.name || undefined,
    });

    const response = NextResponse.json({
      success: true,
      member: {
        id: member.id,
        phone: member.phone,
        countryCode: member.countryCode,
        name: member.name,
      },
    });

    // Set secure httpOnly cookie
    response.cookies.set({
      name: MEMBER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
