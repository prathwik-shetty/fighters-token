import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhoneNumber, sendOtp } from "@/lib/otp";

const SendOtpSchema = z.object({
  phone: z.string().min(5),
  countryCode: z.enum(["+91", "+971"]).default("+91"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid phone number format." }, { status: 400 });
    }

    const normalized = normalizePhoneNumber(parsed.data.phone, parsed.data.countryCode);
    if (!normalized.isValid) {
      return NextResponse.json({ error: normalized.error || "Invalid phone number." }, { status: 400 });
    }

    const result = await sendOtp(normalized.e164);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      phone: normalized.e164,
      demoOtp: result.demoOtp,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json({ error: "Internal server error sending OTP." }, { status: 500 });
  }
}
