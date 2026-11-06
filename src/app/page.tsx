"use client";

import { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import Header from "@/components/Header";
import Legend from "@/components/Legend";
import TokenGrid, { TokenItem } from "@/components/TokenGrid";
import BookingSidebar from "@/components/BookingSidebar";
import HoldCountdown from "@/components/HoldCountdown";
import OtpModal from "@/components/OtpModal";
import { CalculatedSaleStats } from "@/services/stats";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface SaleData {
  id: string;
  title: string;
  description: string | null;
  totalTokens: number;
  pricePerToken: number;
  currency: string;
  paymentsOpen: boolean;
  maxTokensPerMember: number;
  holdDurationSeconds: number;
}

export default function HomePage() {
  const [sale, setSale] = useState<SaleData | null>(null);
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [stats, setStats] = useState<CalculatedSaleStats | null>(null);
  const [member, setMember] = useState<{ id: string; phone: string; name?: string | null; bookedCount?: number } | null>(null);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Member profile
  const fetchMember = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.member) {
        setMember({
          id: data.member.id,
          phone: data.member.phone,
          name: data.member.name,
          bookedCount: data.member.bookedTokens?.length || 0,
        });
      } else {
        setMember(null);
      }
    } catch {
      setMember(null);
    }
  }, []);

  // Fetch tokens and sale data
  const fetchTokens = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const res = await fetch("/api/tokens");
      const data = await res.json();
      if (data.sale) {
        setSale(data.sale);
        setTokens(data.tokens || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("fetchTokens error:", err);
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, []);

  // Initialize and start live polling (every 3 seconds)
  useEffect(() => {
    fetchMember();
    fetchTokens();

    const interval = setInterval(() => {
      fetchTokens(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchMember, fetchTokens]);

  // Member's currently held tokens in cart
  const heldTokens = tokens.filter((t) => t.isHeldByMe && t.status === "HELD");
  const earliestHoldExpiry = heldTokens.reduce<string | null>((earliest, t) => {
    if (!t.holdExpiresAt) return earliest;
    if (!earliest) return t.holdExpiresAt;
    return new Date(t.holdExpiresAt) < new Date(earliest) ? t.holdExpiresAt : earliest;
  }, null);

  // Handle Token Click
  const handleTokenClick = async (token: TokenItem) => {
    if (!member) {
      setIsLoginModalOpen(true);
      return;
    }

    if (token.isHeldByMe) {
      // Deselect / release hold
      try {
        const res = await fetch("/api/tokens/release-hold", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saleId: sale?.id, tokenNumber: token.tokenNumber }),
        });
        if (res.ok) {
          fetchTokens(true);
        }
      } catch (err) {
        console.error("release hold error:", err);
      }
      return;
    }

    if (token.status !== "AVAILABLE") {
      return;
    }

    // Attempt hold
    try {
      const res = await fetch("/api/tokens/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: sale?.id, tokenNumber: token.tokenNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNotification({
          type: "error",
          message: data.error || "Token was just taken by another member. Please pick another token.",
        });
        fetchTokens(true);
        return;
      }

      setNotification(null);
      fetchTokens(true);
    } catch {
      setNotification({
        type: "error",
        message: "Network error holding token. Please try again.",
      });
    }
  };

  // Handle Booking Confirmation
  const handleConfirmBooking = async (name: string) => {
    if (!sale) return;

    const res = await fetch("/api/tokens/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleId: sale.id, memberName: name }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Booking confirmation failed.");
    }

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    setNotification({
      type: "success",
      message: `🎉 Tokens #${data.booking.tokenNumbers.join(", #")} successfully booked! View in "My Tokens".`,
    });

    fetchMember();
    fetchTokens();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMember(null);
    fetchTokens();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        member={member}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6">
        {/* Banner Notice / Headline */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 rounded-2xl p-5 sm:p-7 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-700/80 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Fighters Annual Campaign</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              {sale?.title || "Fighters Token Sale 2026"}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-xl">
              {sale?.description || "Select your preferred token number(s) on the movie-seat style grid below."}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-emerald-900/80 border border-emerald-700/80 px-4 py-2.5 rounded-xl text-right">
              <span className="block text-[11px] text-emerald-300 uppercase font-bold tracking-wider">
                Price Per Token
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-white">
                ₹{sale?.pricePerToken.toLocaleString("en-IN") || "1,000"}
              </span>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
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

        {/* Active Hold Countdown Banner */}
        {heldTokens.length > 0 && (
          <HoldCountdown
            expiresAt={earliestHoldExpiry}
            heldTokenCount={heldTokens.length}
            onExpire={() => {
              setNotification({
                type: "info",
                message: "Your 180-second token hold has expired. The tokens have been returned to Available.",
              });
              fetchTokens(true);
            }}
          />
        )}

        {/* Legend Bar */}
        <Legend />

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Token Grid (8 cols on lg) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <TokenGrid
              tokens={tokens}
              onTokenClick={handleTokenClick}
              isLoading={isRefreshing}
            />

            <div className="flex items-center justify-between text-xs text-slate-500 px-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Live grid sync active (updates every 3s)</span>
              </span>
              <button
                onClick={() => fetchTokens()}
                className="hover:text-emerald-700 flex items-center gap-1 font-medium transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Refresh Grid</span>
              </button>
            </div>
          </div>

          {/* Booking Details Sidebar (4 cols on lg) */}
          <div className="lg:col-span-4 sticky top-20">
            <BookingSidebar
              member={member}
              heldTokens={heldTokens}
              pricePerToken={sale?.pricePerToken || 1000}
              paymentsOpen={sale?.paymentsOpen || false}
              totalLiveTokens={stats?.effectiveTokens.value || 80}
              bookedCount={stats?.totalBookedAndAssigned.value || 0}
              maxTokensPerMember={sale?.maxTokensPerMember || 5}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onConfirmBooking={handleConfirmBooking}
              onDeselectToken={(t) => handleTokenClick(t)}
            />
          </div>
        </div>
      </main>

      {/* WhatsApp OTP Modal */}
      <OtpModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={(loggedMember) => {
          setMember({
            id: loggedMember.id,
            phone: loggedMember.phone,
            name: loggedMember.name,
            bookedCount: 0,
          });
          fetchTokens();
        }}
      />
    </div>
  );
}
