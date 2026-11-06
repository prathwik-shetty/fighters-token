import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminSession = await getCurrentAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = authenticator.generateSecret();
    const serviceName = "Fighters Token Admin";
    const otpAuthUrl = authenticator.keyuri(adminSession.email, serviceName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Temporarily save pending secret in memory or update admin
    await prisma.adminUser.update({
      where: { id: adminSession.adminId },
      data: { totpSecret: secret },
    });

    return NextResponse.json({
      success: true,
      secret,
      otpAuthUrl,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("totp setup error:", error);
    return NextResponse.json({ error: "Failed to initialize 2FA setup." }, { status: 500 });
  }
}
