"use client";

import { useState, useEffect, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import Header from "@/components/Header";
import OtpModal from "@/components/OtpModal";
import { generateReceiptPdf } from "@/lib/pdf";
import {
  CreditCard,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  XCircle,
  Loader2,
  Calendar,
} from "lucide-react";

interface BookedToken {
  id: string;
  tokenNumber: number;
  status: "BOOKED" | "PAID";
  bookedAt: string;
  bookingId: string;
}

interface BookingGroup {
  id: string;
  tokens: BookedToken[];
  status: "PENDING_PAYMENT" | "PAID" | "CANCELLED";
  totalAmount: number;
  createdAt: string;
  paidAt?: string | null;
  razorpayPaymentId?: string | null;
  paymentWindowExpiresAt?: string | null;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
    };
  }
}

export default function MyTokensPage() {
  const [member, setMember] = useState<{ id: string; phone: string; name?: string | null } | null>(null);
  const [bookings, setBookings] = useState<BookingGroup[]>([]);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [saleStats, setSaleStats] = useState<{ bookedCount: number; totalLive: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Fetch Member & My Tokens
  const fetchMyTokens = useCallback(async () => {
    try {
      const [authRes, tokensRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/tokens"),
      ]);

      const authData = await authRes.json();
      const tokensData = await tokensRes.json();

      if (tokensData.sale) {
        setPaymentsOpen(tokensData.sale.paymentsOpen);
      }
      if (tokensData.stats) {
        setSaleStats({
          bookedCount: tokensData.stats.totalBookedAndAssigned.value,
          totalLive: tokensData.stats.effectiveTokens.value,
        });
      }

      if (authData.authenticated && authData.member) {
        setMember(authData.member);

        // Group booked tokens by bookingId
        const bookedTokens: BookedToken[] = authData.member.bookedTokens || [];
        const groups: Record<string, BookingGroup> = {};

        for (const t of bookedTokens) {
          const bId = t.bookingId || "unassigned";
          if (!groups[bId]) {
            groups[bId] = {
              id: bId,
              tokens: [],
              status: t.status === "PAID" ? "PAID" : "PENDING_PAYMENT",
              totalAmount: 0,
              createdAt: t.bookedAt,
            };
          }
          groups[bId].tokens.push(t);
        }

        // Calculate amounts
        const price = tokensData.sale?.pricePerToken || 1000;
        Object.values(groups).forEach((g) => {
          g.totalAmount = g.tokens.length * price;
          // If all tokens paid
          if (g.tokens.every((t) => t.status === "PAID")) {
            g.status = "PAID";
          }
        });

        setBookings(Object.values(groups));
      } else {
        setMember(null);
        setBookings([]);
      }
    } catch (err) {
      console.error("fetchMyTokens error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyTokens();
  }, [fetchMyTokens]);

  // Handle Pay Now with Razorpay
  const handlePayNow = async (booking: BookingGroup) => {
    if (!paymentsOpen) {
      setNotification({
        type: "info",
        message: `Payments are not yet open. Payment opens once all tokens are booked (${saleStats?.bookedCount || 0} of ${saleStats?.totalLive || 80} booked).`,
      });
      return;
    }

    try {
      setProcessingBookingId(booking.id);
      setNotification(null);

      // Create Razorpay Order
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const orderData = await res.json();
      if (!res.ok) {
        throw new Error(orderData.error || "Failed to initiate payment.");
      }

      // Check if Mock payment (for test / sample keys in development)
      if (orderData.isMock || !window.Razorpay) {
        // Offer instant mock test payment approval
        const confirmMock = confirm(
          `Demo Payment Gateway:\nAmount: ₹${(orderData.amount / 100).toLocaleString("en-IN")}\nBooking ID: ${orderData.bookingId}\n\nClick OK to simulate successful Razorpay payment verification.`
        );

        if (confirmMock) {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId: booking.id,
              razorpayOrderId: orderData.orderId,
              razorpayPaymentId: `pay_mock_${Date.now()}`,
              razorpaySignature: "mock_signature_approved",
            }),
          });

          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setNotification({
              type: "success",
              message: verifyData.message || "Payment verified successfully!",
            });
            fetchMyTokens();
            return;
          }
        }
      }

      // Live / Sandbox Razorpay Checkout
      if (window.Razorpay) {
        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Fighters Token",
          description: `Payment for Tokens #${orderData.tokenNumbers?.join(", #")}`,
          order_id: orderData.orderId,
          prefill: {
            name: orderData.memberName,
            contact: orderData.memberPhone,
          },
          theme: {
            color: "#064e3b",
          },
          handler: async (response: RazorpayResponse) => {
            try {
              const verifyRes = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bookingId: booking.id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });

              const verifyData = await verifyRes.json();
              if (verifyRes.ok) {
                setNotification({
                  type: "success",
                  message: verifyData.message || "Payment verified successfully! Tokens confirmed.",
                });
                fetchMyTokens();
              } else {
                throw new Error(verifyData.error || "Payment signature verification failed.");
              }
            } catch (err: unknown) {
              setNotification({
                type: "error",
                message: err instanceof Error ? err.message : "Payment verification failed.",
              });
            }
          },
          modal: {
            ondismiss: () => {
              setProcessingBookingId(null);
            },
          },
        });

        rzp.open();
      }
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Payment failed to start.",
      });
    } finally {
      setProcessingBookingId(null);
    }
  };

  // Handle Cancel Unpaid Token
  const handleCancelToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to release this token back to available?")) {
      return;
    }

    try {
      const res = await fetch("/api/tokens/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel token.");
      }

      setNotification({
        type: "success",
        message: "Token successfully released back to Available.",
      });
      fetchMyTokens();
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel token.",
      });
    }
  };

  // Handle Download PDF Receipt
  const handleDownloadReceipt = (booking: BookingGroup) => {
    const doc = generateReceiptPdf({
      bookingId: booking.id,
      memberName: member?.name || "Fighters Member",
      memberPhone: member?.phone || "",
      tokenNumbers: booking.tokens.map((t) => t.tokenNumber),
      amount: booking.totalAmount,
      razorpayPaymentId: booking.razorpayPaymentId || `pay_verified_${booking.id.slice(0, 8)}`,
      paidAt: booking.paidAt || new Date().toISOString(),
      saleTitle: "Fighters Token Sale 2026",
    });

    doc.save(`fighters-token-receipt-${booking.id.slice(0, 8)}.pdf`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <Header
        member={member ? { ...member, bookedCount: bookings.reduce((acc, b) => acc + b.tokens.length, 0) } : null}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          setMember(null);
          setBookings([]);
        }}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 mb-2 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Token Grid</span>
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              My Booked Tokens
            </h1>
            <p className="text-xs text-slate-500">
              Track your reservation status, complete payments, and download official receipts.
            </p>
          </div>

          {member && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs">
              <span className="text-slate-400 block font-medium">Account:</span>
              <span className="font-bold text-slate-800">{member.name || member.phone}</span>
            </div>
          )}
        </div>

        {/* Notification Banner */}
        {notification && (
          <div
            className={`rounded-xl p-4 border flex items-start justify-between gap-3 ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : notification.type === "error"
                ? "bg-rose-50 border-rose-300 text-rose-900"
                : "bg-blue-50 border-blue-300 text-blue-900"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs font-bold opacity-75 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Not Logged In State */}
        {!member ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Clock className="w-8 h-8" />
            </div>
            <div className="max-w-sm">
              <h3 className="text-lg font-bold text-slate-900">Please Log In</h3>
              <p className="text-xs text-slate-500 mt-1">
                Log in with your WhatsApp number to view your booked tokens, payments, and receipts.
              </p>
            </div>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition"
            >
              Login with WhatsApp
            </button>
          </div>
        ) : isLoading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="max-w-sm">
              <h3 className="text-lg font-bold text-slate-900">No Booked Tokens Yet</h3>
              <p className="text-xs text-slate-500 mt-1">
                You haven&apos;t reserved any tokens yet. Head back to the grid and choose your favorite numbers!
              </p>
            </div>
            <Link
              href="/"
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md transition"
            >
              Go to Token Grid
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {bookings.map((booking) => {
              const isPaid = booking.status === "PAID";

              return (
                <div
                  key={booking.id}
                  className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 shadow-sm ${
                    isPaid ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Booking ID: {booking.id.slice(0, 8)}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-rose-100 text-rose-800 border-rose-300"
                          }`}
                        >
                          {isPaid ? "PAID & CONFIRMED" : "PAYMENT PENDING"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Reserved on {new Date(booking.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Total Amount</span>
                      <span className="text-xl font-extrabold text-slate-900">
                        ₹{booking.totalAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Token list */}
                  <div className="py-4">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                      Reserved Token Numbers ({booking.tokens.length}):
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {booking.tokens.map((token) => (
                        <div
                          key={token.id}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 shadow-sm ${
                            isPaid
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                              : "bg-rose-50 border-rose-200 text-rose-900 font-bold"
                          }`}
                        >
                          <span className="text-sm">#{String(token.tokenNumber).padStart(2, "0")}</span>
                          {!isPaid && (
                            <button
                              onClick={() => handleCancelToken(token.id)}
                              title="Cancel & release this token"
                              className="text-slate-400 hover:text-rose-600 transition p-0.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Gating Message / Action Bar */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {!isPaid ? (
                      <>
                        <div className="text-xs text-slate-500 max-w-md">
                          {paymentsOpen ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Payments are open! Complete checkout before the pay-by deadline.</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>
                                Booked — payment opens when all tokens are booked ({saleStats?.bookedCount || 0} of {saleStats?.totalLive || 80} done).
                              </span>
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handlePayNow(booking)}
                          disabled={!paymentsOpen || processingBookingId === booking.id}
                          className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 active:scale-95 shrink-0"
                        >
                          {processingBookingId === booking.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Opening Razorpay...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              <span>{paymentsOpen ? "Pay Now (₹" + booking.totalAmount.toLocaleString("en-IN") + ")" : "Payment Locked"}</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Official ownership certificate verified and locked in ledger.</span>
                        </div>

                        <button
                          onClick={() => handleDownloadReceipt(booking)}
                          className="py-2 px-4 bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 active:scale-95 shrink-0"
                        >
                          <Download className="w-4 h-4 text-emerald-300" />
                          <span>Download PDF Receipt</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <OtpModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          fetchMyTokens();
        }}
      />
    </div>
  );
}
