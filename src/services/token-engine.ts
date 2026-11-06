import crypto from "crypto";
import prisma from "@/lib/db";
import { calculateSaleStats } from "./stats";

export interface HoldResult {
  success: boolean;
  token?: {
    id: string;
    tokenNumber: number;
    status: string;
    holdExpiresAt: Date;
  };
  error?: string;
}

export interface ConfirmResult {
  success: boolean;
  booking?: {
    id: string;
    tokenNumbers: number[];
    tokenCount: number;
    totalAmount: number;
    memberName: string;
  };
  error?: string;
}

export interface AdminAssignResult {
  success: boolean;
  assignedTokens: number[];
  assignedCount: number;
  recipientName: string;
  auditLogId?: string;
  error?: string;
}

/**
 * Releases any expired token holds across the active sale.
 * Runs on-demand before hold/confirm queries or via periodic cleanup cron.
 */
export async function releaseExpiredHolds(saleId?: string) {
  const now = new Date();
  const whereClause: { status: "HELD"; holdExpiresAt: { lte: Date }; saleId?: string } = {
    status: "HELD",
    holdExpiresAt: {
      lte: now,
    },
  };
  if (saleId) {
    whereClause.saleId = saleId;
  }

  const expiredTokens = await prisma.token.findMany({
    where: whereClause,
    select: { id: true, tokenNumber: true },
  });

  if (expiredTokens.length > 0) {
    await prisma.token.updateMany({
      where: {
        id: { in: expiredTokens.map((t) => t.id) },
        status: "HELD",
      },
      data: {
        status: "AVAILABLE",
        heldByMemberId: null,
        holdExpiresAt: null,
      },
    });
  }

  return expiredTokens.length;
}

/**
 * Holds a specific token for a member for the configured duration (default 180s).
 * Enforces per-member limit and race-condition safety via transactional atomic checks.
 */
export async function holdToken(params: {
  saleId: string;
  tokenNumber: number;
  memberId: string;
}): Promise<HoldResult> {
  const { saleId, tokenNumber, memberId } = params;

  // Clean up any stale holds first
  await releaseExpiredHolds(saleId);

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
  });

  if (!sale || !sale.isLive) {
    return { success: false, error: "The token sale is currently not active." };
  }

  // Check how many tokens the member currently has held or booked
  const currentMemberCount = await prisma.token.count({
    where: {
      saleId,
      OR: [
        { heldByMemberId: memberId, status: "HELD" },
        { bookedByMemberId: memberId, status: { in: ["BOOKED", "PAID"] } },
      ],
    },
  });

  if (currentMemberCount >= sale.maxTokensPerMember) {
    return {
      success: false,
      error: `You have reached the maximum allowed limit of ${sale.maxTokensPerMember} tokens per member.`,
    };
  }

  const holdDurationSeconds = Math.max(120, Math.min(180, sale.holdDurationSeconds || 180));
  const holdExpiresAt = new Date(Date.now() + holdDurationSeconds * 1000);

  // Atomic update using Prisma transaction to prevent race conditions:
  // Updates ONLY IF status is AVAILABLE or (status is HELD but hold has expired)
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.token.findUnique({
      where: {
        saleId_tokenNumber: {
          saleId,
          tokenNumber,
        },
      },
    });

    if (!existing) {
      return { success: false, error: `Token #${tokenNumber} does not exist.` };
    }

    if (existing.status === "FROZEN") {
      return { success: false, error: `Token #${tokenNumber} is frozen and cannot be booked.` };
    }

    if (existing.status === "BOOKED" || existing.status === "PAID") {
      return { success: false, error: `Token #${tokenNumber} was just taken by another member. Please pick another token.` };
    }

    const isCurrentlyHeldByAnother =
      existing.status === "HELD" &&
      existing.heldByMemberId !== memberId &&
      existing.holdExpiresAt &&
      existing.holdExpiresAt > new Date();

    if (isCurrentlyHeldByAnother) {
      return { success: false, error: `Token #${tokenNumber} is currently held by someone else. Please pick another token.` };
    }

    // Assign hold to this member
    const updated = await tx.token.update({
      where: { id: existing.id },
      data: {
        status: "HELD",
        heldByMemberId: memberId,
        holdExpiresAt,
        version: { increment: 1 },
      },
    });

    return {
      success: true,
      token: {
        id: updated.id,
        tokenNumber: updated.tokenNumber,
        status: updated.status,
        holdExpiresAt: updated.holdExpiresAt!,
      },
    };
  });

  return result;
}

/**
 * Releases a hold on a token held by the current member.
 */
export async function releaseHold(params: {
  saleId: string;
  tokenNumber: number;
  memberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { saleId, tokenNumber, memberId } = params;

  const token = await prisma.token.findUnique({
    where: {
      saleId_tokenNumber: {
        saleId,
        tokenNumber,
      },
    },
  });

  if (!token) {
    return { success: false, error: "Token not found." };
  }

  if (token.heldByMemberId !== memberId || token.status !== "HELD") {
    return { success: false, error: "Token is not currently held by you." };
  }

  await prisma.token.update({
    where: { id: token.id },
    data: {
      status: "AVAILABLE",
      heldByMemberId: null,
      holdExpiresAt: null,
      version: { increment: 1 },
    },
  });

  return { success: true };
}

/**
 * Confirms all currently held tokens for a member and converts them to BOOKED status.
 * Requires member's full name.
 */
export async function confirmMemberBooking(params: {
  saleId: string;
  memberId: string;
  memberName: string;
}): Promise<ConfirmResult> {
  const { saleId, memberId, memberName } = params;

  if (!memberName || memberName.trim().length < 2) {
    return { success: false, error: "Please enter your full name to confirm booking." };
  }

  // Release any stale holds across the sale first
  await releaseExpiredHolds(saleId);

  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale || !sale.isLive) {
    return { success: false, error: "Sale is not active." };
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return { success: false, error: "Member profile not found." };
  }

  // Update member name in profile if not already set
  await prisma.member.update({
    where: { id: memberId },
    data: { name: memberName.trim() },
  });

  // Execute confirmation atomically within a database transaction
  const result = await prisma.$transaction(async (tx) => {
    // Find all unexpired held tokens for this member
    const heldTokens = await tx.token.findMany({
      where: {
        saleId,
        heldByMemberId: memberId,
        status: "HELD",
        holdExpiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { tokenNumber: "asc" },
    });

    if (heldTokens.length === 0) {
      return {
        success: false,
        error: "Your token hold has expired or no tokens were selected. Please select available tokens again.",
      };
    }

    const tokenCount = heldTokens.length;
    const totalAmount = tokenCount * sale.pricePerToken;

    // Create Booking record
    const booking = await tx.booking.create({
      data: {
        saleId,
        memberId,
        memberName: memberName.trim(),
        memberPhone: member.phone,
        tokenCount,
        totalAmount,
        status: "PENDING_PAYMENT",
      },
    });

    // Update tokens to BOOKED status
    await tx.token.updateMany({
      where: {
        id: { in: heldTokens.map((t) => t.id) },
      },
      data: {
        status: "BOOKED",
        bookedByMemberId: memberId,
        bookedAt: new Date(),
        bookingId: booking.id,
        heldByMemberId: null,
        holdExpiresAt: null,
      },
    });

    return {
      success: true,
      booking: {
        id: booking.id,
        tokenNumbers: heldTokens.map((t) => t.tokenNumber),
        tokenCount,
        totalAmount,
        memberName: memberName.trim(),
      },
    };
  });

  // Check 10% auto-assignment trigger rule after new booking
  if (result.success && !sale.autoAssignExecuted && sale.autoAssignTargetName) {
    await checkAndExecuteAutoAssignment(saleId);
  }

  return result;
}

/**
 * Cancels a BOOKED but unpaid token by the member, releasing it immediately.
 */
export async function cancelUnpaidToken(params: {
  saleId: string;
  tokenId: string;
  memberId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { saleId, tokenId, memberId } = params;

  const token = await prisma.token.findUnique({
    where: { id: tokenId },
    include: { booking: true },
  });

  if (!token || token.saleId !== saleId) {
    return { success: false, error: "Token not found." };
  }

  if (token.bookedByMemberId !== memberId) {
    return { success: false, error: "You can only cancel your own bookings." };
  }

  if (token.status === "PAID") {
    return {
      success: false,
      error: "Paid tokens cannot be cancelled directly by members. Please contact support or admin for refund assistance.",
    };
  }

  if (token.status !== "BOOKED") {
    return { success: false, error: "Only booked tokens can be cancelled." };
  }

  // Release token back to AVAILABLE
  await prisma.$transaction(async (tx) => {
    await tx.token.update({
      where: { id: token.id },
      data: {
        status: "AVAILABLE",
        bookedByMemberId: null,
        bookedAt: null,
        bookingId: null,
        version: { increment: 1 },
      },
    });

    // Update parent booking if all tokens in it are released or adjust count
    if (token.bookingId) {
      const remainingTokens = await tx.token.count({
        where: { bookingId: token.bookingId },
      });

      if (remainingTokens === 0) {
        await tx.booking.update({
          where: { id: token.bookingId },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
      } else {
        const sale = await tx.sale.findUnique({ where: { id: saleId } });
        const price = sale?.pricePerToken || 1000;
        await tx.booking.update({
          where: { id: token.bookingId },
          data: {
            tokenCount: remainingTokens,
            totalAmount: remainingTokens * price,
          },
        });
      }
    }
  });

  return { success: true };
}

/**
 * Cryptographically secure random selection of N elements from an array.
 * Uses crypto.randomInt to prevent modulo bias and ensure unbiased auditability.
 */
export function secureRandomPick<T>(items: T[], count: number): { selected: T[]; entropyLog: string } {
  if (count <= 0 || items.length === 0) {
    return { selected: [], entropyLog: "Empty items or zero count" };
  }

  const pool = [...items];
  const selected: T[] = [];
  const logSteps: string[] = [];

  const needed = Math.min(count, pool.length);
  for (let i = 0; i < needed; i++) {
    const randomIndex = crypto.randomInt(0, pool.length);
    const chosen = pool.splice(randomIndex, 1)[0];
    selected.push(chosen);
    logSteps.push(`Step ${i + 1}: index ${randomIndex} picked from remaining ${pool.length + 1}`);
  }

  return {
    selected,
    entropyLog: logSteps.join("; "),
  };
}

/**
 * Admin action: Book on behalf of someone.
 * Randomly picks N AVAILABLE, non-frozen tokens and assigns them to the given name.
 */
export async function adminAssignTokens(params: {
  saleId: string;
  recipientName: string;
  recipientPhone?: string;
  count: number;
  adminActor: string;
}): Promise<AdminAssignResult> {
  const { saleId, recipientName, recipientPhone, count, adminActor } = params;

  if (!recipientName || recipientName.trim().length < 2) {
    return { success: false, assignedTokens: [], assignedCount: 0, recipientName: "", error: "Valid recipient name is required." };
  }

  if (count <= 0) {
    return { success: false, assignedTokens: [], assignedCount: 0, recipientName, error: "Count must be at least 1." };
  }

  // Release stale holds first
  await releaseExpiredHolds(saleId);

  // Find all currently AVAILABLE tokens (non-frozen)
  const availableTokens = await prisma.token.findMany({
    where: {
      saleId,
      status: "AVAILABLE",
    },
    orderBy: { tokenNumber: "asc" },
  });

  if (availableTokens.length < count) {
    return {
      success: false,
      assignedTokens: [],
      assignedCount: 0,
      recipientName,
      error: `Only ${availableTokens.length} available tokens remain in the sale. Cannot allocate ${count}.`,
    };
  }

  // Cryptographically secure random selection
  const { selected, entropyLog } = secureRandomPick(availableTokens, count);
  const assignedTokenNumbers = selected.map((t) => t.tokenNumber).sort((a, b) => a - b);

  // Perform assignment in transaction
  await prisma.$transaction(async (tx) => {
    await tx.token.updateMany({
      where: {
        id: { in: selected.map((t) => t.id) },
      },
      data: {
        status: "BOOKED",
        isAdminAssigned: true,
        adminAssignedName: recipientName.trim(),
        bookedAt: new Date(),
        version: { increment: 1 },
      },
    });

    // Record audit log
    await tx.adminActionLog.create({
      data: {
        actor: adminActor,
        action: "ADMIN_ASSIGN_TOKENS",
        details: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone || null,
          count,
          assignedTokenNumbers,
          entropyLog,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  });

  return {
    success: true,
    assignedTokens: assignedTokenNumbers,
    assignedCount: assignedTokenNumbers.length,
    recipientName: recipientName.trim(),
  };
}

/**
 * Checks if the 10% auto-assignment threshold has been met and triggers random allocation.
 */
export async function checkAndExecuteAutoAssignment(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      tokens: true,
    },
  });

  if (!sale || sale.autoAssignExecuted || !sale.autoAssignTargetName) {
    return null;
  }

  const frozenCount = sale.tokens.filter((t) => t.status === "FROZEN").length;
  const availableCount = sale.tokens.filter((t) => t.status === "AVAILABLE").length;
  const heldCount = sale.tokens.filter((t) => t.status === "HELD").length;
  const memberBookedCount = sale.tokens.filter((t) => t.status === "BOOKED" && !t.isAdminAssigned).length;
  const adminAssignedCount = sale.tokens.filter((t) => t.isAdminAssigned).length;
  const paidCount = sale.tokens.filter((t) => t.status === "PAID").length;

  const stats = calculateSaleStats({
    totalTokens: sale.totalTokens,
    pricePerToken: sale.pricePerToken,
    frozenCount,
    availableCount,
    heldCount,
    memberBookedCount,
    adminAssignedCount,
    paidCount,
    refundsCount: 0,
    refundsAmount: 0,
    thresholdPercentage: sale.autoAssignThresholdPercent || 10.0,
  });

  if (stats.thresholdCheck.thresholdMet && availableCount >= sale.autoAssignKTokens) {
    const k = sale.autoAssignKTokens || 1;
    const targetName = sale.autoAssignTargetName;

    const assignResult = await adminAssignTokens({
      saleId,
      recipientName: targetName,
      count: k,
      adminActor: "SYSTEM_10_PERCENT_RULE",
    });

    if (assignResult.success) {
      await prisma.sale.update({
        where: { id: saleId },
        data: {
          autoAssignExecuted: true,
        },
      });

      await prisma.adminActionLog.create({
        data: {
          actor: "SYSTEM",
          action: "AUTO_ASSIGN_10_PERCENT_TRIGGERED",
          details: JSON.stringify({
            saleId,
            thresholdPercent: sale.autoAssignThresholdPercent,
            targetName,
            assignedTokens: assignResult.assignedTokens,
            statsSummary: stats.thresholdCheck.displaySummary,
          }),
        },
      });
    }

    return assignResult;
  }

  return null;
}
