import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const status = searchParams.get("status") || "ALL";

    // Query bookings with tokens and payments
    const bookings = await prisma.booking.findMany({
      include: {
        tokens: {
          select: { id: true, tokenNumber: true, status: true, isAdminAssigned: true },
          orderBy: { tokenNumber: "asc" },
        },
        payments: {
          select: { id: true, razorpayPaymentId: true, amount: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Also get admin-assigned tokens without member booking
    const adminAssignedTokens = await prisma.token.findMany({
      where: {
        isAdminAssigned: true,
        bookingId: null,
      },
      orderBy: { tokenNumber: "asc" },
    });

    type Row = {
      id: string;
      name: string;
      phone: string;
      tokenNumbers: number[];
      tokenIds: string[];
      status: string;
      amount: number;
      paymentId: string | null;
      payByDate: string | null;
      createdAt: string;
      isAdminAssigned: boolean;
    };

    const rows: Row[] = [];

    for (const b of bookings) {
      rows.push({
        id: b.id,
        name: b.memberName,
        phone: b.memberPhone,
        tokenNumbers: b.tokens.map((t) => t.tokenNumber),
        tokenIds: b.tokens.map((t) => t.id),
        status: b.status,
        amount: b.totalAmount,
        paymentId: b.razorpayPaymentId || b.payments[0]?.razorpayPaymentId || null,
        payByDate: b.payByDeadline ? b.payByDeadline.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
        isAdminAssigned: b.tokens.some((t) => t.isAdminAssigned),
      });
    }

    // Group admin-assigned tokens by name
    const groupedAssigned: Record<string, { tokens: number[]; tokenIds: string[]; createdAt: string }> = {};
    for (const t of adminAssignedTokens) {
      const name = t.adminAssignedName || "Admin Assigned";
      if (!groupedAssigned[name]) {
        groupedAssigned[name] = { tokens: [], tokenIds: [], createdAt: t.createdAt.toISOString() };
      }
      groupedAssigned[name].tokens.push(t.tokenNumber);
      groupedAssigned[name].tokenIds.push(t.id);
    }

    for (const [name, val] of Object.entries(groupedAssigned)) {
      rows.push({
        id: `admin_assigned_${name}`,
        name,
        phone: "— (Admin Allocated)",
        tokenNumbers: val.tokens,
        tokenIds: val.tokenIds,
        status: "ADMIN_ASSIGNED",
        amount: 0,
        paymentId: "N/A (Exempt)",
        payByDate: "N/A",
        createdAt: val.createdAt,
        isAdminAssigned: true,
      });
    }

    // Filter by search & status
    const filtered = rows.filter((r) => {
      const matchesSearch =
        !search ||
        r.name.toLowerCase().includes(search) ||
        r.phone.toLowerCase().includes(search) ||
        r.tokenNumbers.some((n) => n.toString() === search);

      const matchesStatus =
        status === "ALL" ||
        r.status === status ||
        (status === "PAID" && r.status === "PAID") ||
        (status === "PENDING" && r.status === "PENDING_PAYMENT");

      return matchesSearch && matchesStatus;
    });

    return NextResponse.json({
      members: filtered,
      totalCount: filtered.length,
    });
  } catch (error) {
    console.error("members list error:", error);
    return NextResponse.json({ error: "Failed to load members." }, { status: 500 });
  }
}
