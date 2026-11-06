import { jsPDF } from "jspdf";

export interface ReceiptData {
  bookingId: string;
  memberName: string;
  memberPhone: string;
  tokenNumbers: number[];
  amount: number;
  razorpayPaymentId: string;
  paidAt: string;
  saleTitle: string;
}

export function generateReceiptPdf(data: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Dark green header banner (#064e3b)
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, 210, 40, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("FIGHTERS TOKEN", 20, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("OFFICIAL BOOKING RECEIPT & TOKEN CERTIFICATE", 20, 32);

  // Status Badge
  doc.setFillColor(16, 185, 129); // Emerald green
  doc.roundedRect(145, 12, 45, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("VERIFIED & PAID", 150, 22);

  // Body content
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Token Allocation Certificate", 20, 55);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Campaign: ${data.saleTitle}`, 20, 62);
  doc.text(`Issue Date: ${new Date(data.paidAt).toLocaleDateString("en-IN", { dateStyle: "long" })}`, 20, 68);

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 74, 190, 74);

  // Member details table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Member Details", 20, 84);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Full Name:", 20, 92);
  doc.setFont("helvetica", "bold");
  doc.text(data.memberName, 65, 92);

  doc.setFont("helvetica", "normal");
  doc.text("WhatsApp Number:", 20, 100);
  doc.setFont("helvetica", "bold");
  doc.text(data.memberPhone, 65, 100);

  doc.setFont("helvetica", "normal");
  doc.text("Booking ID:", 20, 108);
  doc.setFont("helvetica", "bold");
  doc.text(data.bookingId, 65, 108);

  // Token Allocation Box
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(5, 150, 105);
  doc.roundedRect(20, 118, 170, 36, 4, 4, "FD");

  doc.setTextColor(5, 150, 105);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("ALLOCATED TOKEN NUMBER(S):", 28, 128);

  doc.setFontSize(18);
  const formattedTokens = data.tokenNumbers.map((n) => `#${String(n).padStart(2, "0")}`).join("   ");
  doc.text(formattedTokens, 28, 142);

  // Payment Breakdown
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Information", 20, 168);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Total Tokens:", 20, 176);
  doc.text(data.tokenNumbers.length.toString(), 90, 176);

  doc.text("Amount Paid:", 20, 184);
  doc.setFont("helvetica", "bold");
  doc.text(`INR ${data.amount.toLocaleString("en-IN")}`, 90, 184);

  doc.setFont("helvetica", "normal");
  doc.text("Razorpay Payment ID:", 20, 192);
  doc.setFont("helvetica", "bold");
  doc.text(data.razorpayPaymentId, 90, 192);

  doc.setFont("helvetica", "normal");
  doc.text("Payment Method:", 20, 200);
  doc.text("Razorpay Secure Checkout (UPI / Cards / Netbanking)", 90, 200);

  // Security Note
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 215, 170, 30, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "This certificate verifies full ownership and confirmed allocation of the listed token(s) in Fighters Token.",
    25,
    224
  );
  doc.text(
    "Cryptographically validated and locked in database. Keep this certificate for your official records.",
    25,
    232
  );

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Fighters Token Platform • All rights reserved.", 20, 280);
  doc.text(`Generated: ${new Date().toISOString()}`, 130, 280);

  return doc;
}
