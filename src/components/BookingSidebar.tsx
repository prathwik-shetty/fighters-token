"use client";

import { useState } from "react";
import { User, Phone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { TokenItem } from "./TokenGrid";

interface BookingSidebarProps {
  member: {
    id: string;
    phone: string;
    name?: string | null;
  } | null;
  heldTokens: TokenItem[];
  pricePerToken: number;
  paymentsOpen: boolean;
  totalLiveTokens: number;
  bookedCount: number;
  maxTokensPerMember: number;
  onOpenLogin: () => void;
  onConfirmBooking: (name: string) => Promise<void>;
  onDeselectToken: (token: TokenItem) => void;
}

export default function BookingSidebar({
  member,
  heldTokens,
  pricePerToken,
  paymentsOpen,
  totalLiveTokens,
  bookedCount,
  maxTokensPerMember,
  onOpenLogin,
  onConfirmBooking,
  onDeselectToken,
}: BookingSidebarProps) {
  const [memberName, setMemberName] = useState(member?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalAmount = heldTokens.length * pricePerToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!member) {
      onOpenLogin();
      return;
    }

    if (heldTokens.length === 0) {
      setErrorMsg("Please select at least 1 available token from the grid.");
      return;
    }

    if (!memberName.trim() || memberName.trim().length < 2) {
      setErrorMsg("Please enter your full name to confirm booking.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmBooking(memberName.trim());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to confirm booking.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col gap-5">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Booking Details
        </h3>
        <p className="text-xs text-slate-500">
          Limit: {maxTokensPerMember} tokens per member.
        </p>
      </div>

      {/* Member Login Status Card */}
      {!member ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-900 font-medium mb-3">
            Log in with your WhatsApp number to hold and book tokens.
          </p>
          <button
            type="button"
            onClick={onOpenLogin}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            <span>Login with WhatsApp</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {member.phone}
              </div>
              <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified Member</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Member Name Field */}
        <div>
          <label htmlFor="memberName" className="block text-xs font-bold text-slate-700 mb-1.5">
            Member Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="memberName"
              type="text"
              required
              disabled={isSubmitting}
              value={memberName}
              onChange={(e) => {
                setMemberName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="e.g. Rahul Sharma / Ali Al-Mansoor"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Selected Tokens Display */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span>Selected Tokens</span>
            <span className="text-emerald-700">{heldTokens.length} of {maxTokensPerMember}</span>
          </div>

          {heldTokens.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400">
              No tokens selected yet. Tap any light green token on the grid.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {heldTokens.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => onDeselectToken(t)}
                  title="Click to remove hold"
                  className="px-2.5 py-1 bg-amber-500 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <span>#{String(t.tokenNumber).padStart(2, "0")}</span>
                  <span className="text-[10px] opacity-75">✕</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price & Amount Summary */}
        <div className="border-t border-slate-100 pt-3 flex flex-col gap-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Price per token:</span>
            <span className="font-semibold text-slate-700">₹{pricePerToken.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100">
            <span>Total Payable:</span>
            <span className="text-emerald-700 text-base">₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Payment Gating Status Notice */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            {paymentsOpen ? (
              <span className="font-semibold text-emerald-800">
                🎉 Payments are open! After confirming, you can complete payment on My Tokens.
              </span>
            ) : (
              <span>
                <strong>Payment gating active:</strong> Payments open when all tokens are booked ({bookedCount} of {totalLiveTokens} booked). You will not be charged right now.
              </span>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Confirm Button */}
        <button
          type="submit"
          disabled={isSubmitting || heldTokens.length === 0}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Confirming Booking...</span>
            </>
          ) : (
            <span>Confirm Booking ({heldTokens.length})</span>
          )}
        </button>
      </form>
    </div>
  );
}
