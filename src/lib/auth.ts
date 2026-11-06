import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fighters_token_default_jwt_secret_key_32_chars_min!"
);

const ADMIN_SECRET = new TextEncoder().encode(
  process.env.ADMIN_SESSION_SECRET || "fighters_token_default_admin_secret_key_32_chars_min!"
);

export const MEMBER_COOKIE_NAME = "fighters_member_session";
export const ADMIN_COOKIE_NAME = "fighters_admin_session";

export interface MemberSessionPayload {
  memberId: string;
  phone: string;
  countryCode: string;
  name?: string;
}

export interface AdminSessionPayload {
  adminId: string;
  email: string;
  role: string;
  totpVerified: boolean;
}

/**
 * Signs a JWT session for a member (valid for 30 days)
 */
export async function signMemberToken(payload: MemberSessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

/**
 * Verifies a member JWT token
 */
export async function verifyMemberToken(token: string): Promise<MemberSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as MemberSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Signs an admin JWT session (valid for 24 hours)
 */
export async function signAdminToken(payload: AdminSessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(ADMIN_SECRET);
}

/**
 * Verifies an admin JWT session
 */
export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ADMIN_SECRET);
    return payload as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Server-side helper to read the current member session from cookies
 */
export async function getCurrentMember(): Promise<MemberSessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(MEMBER_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyMemberToken(token);
}

/**
 * Server-side helper to read the current admin session from cookies
 */
export async function getCurrentAdmin(): Promise<AdminSessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  const admin = await verifyAdminToken(token);
  if (!admin || !admin.totpVerified) return null;
  return admin;
}
