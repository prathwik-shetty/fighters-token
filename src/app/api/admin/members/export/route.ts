import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookings = await prisma.booking.findMany({
      include: {
        tokens: { orderBy: { tokenNumber: "asc" } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // CSV header
    const headers = [
      "Booking ID",
      "Member Name",
      "Phone",
      "Token Count",
      "Token Numbers",
      "Status",
      "Total Amount (INR)",
      "Razorpay Payment ID",
      "Created At",
      "Paid At",
    ];

    const rows = bookings.map((b) => [
      `"${b.id}"`,
      `"${b.memberName.replace(/"/g, '""')}"`,
      `"${b.memberPhone}"`,
      b.tokenCount,
      `"${b.tokens.map((t) => t.tokenNumber).join(", ")}"`,
      `"${b.status}"`,
      b.totalAmount,
      `"${b.razorpayPaymentId || b.payments[0]?.razorpayPaymentId || ""}"`,
      `"${b.createdAt.toISOString()}"`,
      `"${b.paidAt ? b.paidAt.toISOString() : ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fighters-tokens-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("csv export error:", error);
    return NextResponse.json({ error: "Failed to export CSV." }, { status: 500 });
  }
}
