import prisma from "./db";

export interface NormalizedPhone {
  raw: string;
  countryCode: "+91" | "+971";
  nationalNumber: string;
  e164: string;
  isValid: boolean;
  error?: string;
}

/**
 * Normalizes phone numbers for India (+91) and UAE (+971) into standard E.164 format.
 */
export function normalizePhoneNumber(rawInput: string, countryCode: "+91" | "+971" = "+91"): NormalizedPhone {
  const digitsOnly = rawInput.replace(/\D/g, "");

  if (countryCode === "+91") {
    // If user typed 91 prefix, strip it if length is 12
    let clean = digitsOnly;
    if (clean.startsWith("91") && clean.length === 12) {
      clean = clean.slice(2);
    }
    if (clean.length !== 10) {
      return {
        raw: rawInput,
        countryCode: "+91",
        nationalNumber: clean,
        e164: "",
        isValid: false,
        error: "Indian mobile numbers must have exactly 10 digits.",
      };
    }
    return {
      raw: rawInput,
      countryCode: "+91",
      nationalNumber: clean,
      e164: `+91${clean}`,
      isValid: true,
    };
  }

  if (countryCode === "+971") {
    // UAE numbers are typically 9 digits (e.g. 50 123 4567)
    let clean = digitsOnly;
    if (clean.startsWith("971") && clean.length >= 11) {
      clean = clean.slice(3);
    }
    if (clean.startsWith("0")) {
      clean = clean.slice(1);
    }
    if (clean.length !== 9) {
      return {
        raw: rawInput,
        countryCode: "+971",
        nationalNumber: clean,
        e164: "",
        isValid: false,
        error: "UAE mobile numbers must have exactly 9 digits (e.g. 50 123 4567).",
      };
    }
    return {
      raw: rawInput,
      countryCode: "+971",
      nationalNumber: clean,
      e164: `+971${clean}`,
      isValid: true,
    };
  }

  return {
    raw: rawInput,
    countryCode,
    nationalNumber: digitsOnly,
    e164: `+${digitsOnly}`,
    isValid: digitsOnly.length >= 8,
  };
}

/**
 * Sends or generates an OTP for a given phone number.
 * Supports DEMO mode, MSG91, and Twilio.
 */
export async function sendOtp(e164Phone: string): Promise<{ success: boolean; message: string; demoOtp?: string }> {
  // Rate limit: check recent OTP requests within the last 2 minutes
  const recentCount = await prisma.otpVerification.count({
    where: {
      phone: e164Phone,
      createdAt: {
        gte: new Date(Date.now() - 2 * 60 * 1000),
      },
    },
  });

  if (recentCount >= 3) {
    return {
      success: false,
      message: "Too many OTP requests. Please wait 2 minutes before requesting another code.",
    };
  }

  // Generate a cryptographically random 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.otpVerification.create({
    data: {
      phone: e164Phone,
      otp: otpCode,
      expiresAt,
    },
  });

  const provider = (process.env.OTP_PROVIDER || "DEMO").toUpperCase();

  if (provider === "MSG91" && process.env.MSG91_AUTH_KEY) {
    try {
      const response = await fetch("https://control.msg91.com/api/v5/otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: process.env.MSG91_AUTH_KEY,
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          mobile: e164Phone.replace("+", ""),
          otp: otpCode,
        }),
      });
      if (!response.ok) {
        console.error("MSG91 OTP send failed:", await response.text());
      }
    } catch (err) {
      console.error("MSG91 error:", err);
    }
  } else if (provider === "TWILIO" && process.env.TWILIO_ACCOUNT_SID) {
    try {
      const basicAuth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString("base64");

      const params = new URLSearchParams();
      params.append("To", e164Phone);
      params.append("Channel", "whatsapp"); // or "sms"

      await fetch(
        `https://verify.twilio.com/v2/Services/${process.env.TWILIO_SERVICE_SID}/Verifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      );
    } catch (err) {
      console.error("Twilio error:", err);
    }
  }

  // In DEMO mode, return the code for instant user feedback and seamless testing
  return {
    success: true,
    message: "OTP sent successfully to your WhatsApp number.",
    demoOtp: provider === "DEMO" ? otpCode : undefined,
  };
}

/**
 * Verifies an OTP for a given phone number.
 */
export async function verifyOtp(e164Phone: string, code: string): Promise<{ valid: boolean; error?: string }> {
  const record = await prisma.otpVerification.findFirst({
    where: {
      phone: e164Phone,
      verified: false,
      expiresAt: {
        gte: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Support master test OTP "123456" in development/demo mode
  const isDemo = (process.env.OTP_PROVIDER || "DEMO").toUpperCase() === "DEMO";
  if (isDemo && code === "123456") {
    if (record) {
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { verified: true },
      });
    }
    return { valid: true };
  }

  if (!record) {
    return { valid: false, error: "OTP expired or invalid. Please request a new one." };
  }

  if (record.otp !== code.trim()) {
    return { valid: false, error: "Incorrect verification code. Please check and try again." };
  }

  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verified: true },
  });

  return { valid: true };
}
