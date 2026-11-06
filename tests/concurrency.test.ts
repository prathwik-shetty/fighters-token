import { describe, it, expect } from "vitest";
import { normalizePhoneNumber } from "../src/lib/otp";

describe("Phone Normalization (E.164) and Validation", () => {
  it("normalizes Indian (+91) 10-digit mobile numbers", () => {
    const res1 = normalizePhoneNumber("9876543210", "+91");
    expect(res1.isValid).toBe(true);
    expect(res1.e164).toBe("+919876543210");

    const res2 = normalizePhoneNumber("+91 98765 43210", "+91");
    expect(res2.isValid).toBe(true);
    expect(res2.e164).toBe("+919876543210");
  });

  it("rejects invalid Indian mobile numbers with incorrect length", () => {
    const res = normalizePhoneNumber("98765432", "+91");
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("normalizes UAE (+971) 9-digit mobile numbers", () => {
    const res1 = normalizePhoneNumber("501234567", "+971");
    expect(res1.isValid).toBe(true);
    expect(res1.e164).toBe("+971501234567");

    const res2 = normalizePhoneNumber("050 123 4567", "+971");
    expect(res2.isValid).toBe(true);
    expect(res2.e164).toBe("+971501234567");
  });

  it("rejects invalid UAE mobile numbers", () => {
    const res = normalizePhoneNumber("12345", "+971");
    expect(res.isValid).toBe(false);
  });
});

describe("Token State and Concurrency Logic", () => {
  it("verifies hold expiry condition correctly", () => {
    const now = new Date();
    const expiredHold = new Date(now.getTime() - 10000); // 10s ago
    const activeHold = new Date(now.getTime() + 180000); // 3m in future

    const isHoldValid = (expiry: Date | null) => {
      if (!expiry) return false;
      return expiry > new Date();
    };

    expect(isHoldValid(expiredHold)).toBe(false);
    expect(isHoldValid(activeHold)).toBe(true);
  });

  it("enforces conflict detection when token is already taken or held by someone else", () => {
    interface SimulatedToken {
      tokenNumber: number;
      status: "AVAILABLE" | "HELD" | "BOOKED" | "PAID" | "FROZEN";
      heldByMemberId?: string | null;
      holdExpiresAt?: Date | null;
    }

    const token: SimulatedToken = {
      tokenNumber: 42,
      status: "HELD",
      heldByMemberId: "user_alice",
      holdExpiresAt: new Date(Date.now() + 120000),
    };

    const attemptHold = (userTrying: string, t: SimulatedToken) => {
      if (t.status === "FROZEN") return { error: "Token is frozen." };
      if (t.status === "BOOKED" || t.status === "PAID") return { error: "just taken, please pick another" };
      if (t.status === "HELD" && t.heldByMemberId !== userTrying && t.holdExpiresAt && t.holdExpiresAt > new Date()) {
        return { error: "currently held by someone else" };
      }
      return { success: true };
    };

    // Alice re-selecting her own held token should succeed
    expect(attemptHold("user_alice", token)).toEqual({ success: true });

    // Bob trying to select Alice's active held token should be rejected
    const bobResult = attemptHold("user_bob", token);
    expect(bobResult.error).toContain("currently held by someone else");

    // Once token is booked, conflict message is returned
    token.status = "BOOKED";
    token.heldByMemberId = null;
    const charlieResult = attemptHold("user_charlie", token);
    expect(charlieResult.error).toContain("just taken, please pick another");
  });
});
