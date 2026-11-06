"use client";

import { useMemo } from "react";
import { Check, Lock, UserCheck, ShieldAlert } from "lucide-react";

export interface TokenItem {
  id: string;
  tokenNumber: number;
  status: "AVAILABLE" | "HELD" | "BOOKED" | "PAID" | "FROZEN";
  isAdminAssigned: boolean;
  adminAssignedName?: string;
  isHeldByMe: boolean;
  isBookedByMe: boolean;
  holdExpiresAt: string | null;
}

interface TokenGridProps {
  tokens: TokenItem[];
  onTokenClick: (token: TokenItem) => void;
  isLoading?: boolean;
}

export default function TokenGrid({ tokens, onTokenClick, isLoading }: TokenGridProps) {
  // Sort tokens by number ascending
  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => a.tokenNumber - b.tokenNumber);
  }, [tokens]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Token Selection Grid
          </h2>
          <p className="text-xs text-slate-500">
            Tap an available token to hold it for 180 seconds.
          </p>
        </div>
        <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
          {tokens.length} Total Tokens
        </div>
      </div>

      {/* Grid container with accessible screen reader support */}
      <div
        role="grid"
        aria-label="Token grid"
        className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 sm:gap-2.5"
      >
        {sortedTokens.map((token) => {
          const { status, isHeldByMe, isBookedByMe, isAdminAssigned, tokenNumber } = token;

          let bgClass = "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 hover:scale-105 active:scale-95 shadow-sm cursor-pointer";
          let stateLabel = "Available";
          let icon = null;
          let isClickable = true;

          if (status === "FROZEN") {
            bgClass = "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-75 line-through";
            stateLabel = "Frozen by admin";
            icon = <ShieldAlert className="w-3 h-3 text-slate-400" />;
            isClickable = false;
          } else if (status === "PAID") {
            bgClass = "bg-emerald-600 text-white border-emerald-700 cursor-not-allowed font-bold shadow-sm";
            stateLabel = isBookedByMe ? "Paid by you" : "Paid & Confirmed";
            icon = <Check className="w-3.5 h-3.5 text-emerald-100 stroke-[3]" />;
            isClickable = false;
          } else if (status === "BOOKED") {
            if (isAdminAssigned) {
              bgClass = "bg-purple-600 text-white border-purple-700 cursor-not-allowed shadow-sm";
              stateLabel = `Admin assigned to ${token.adminAssignedName || "Guest"}`;
              icon = <UserCheck className="w-3.5 h-3.5 text-purple-200" />;
              isClickable = false;
            } else {
              bgClass = "bg-rose-500 text-white border-rose-600 cursor-not-allowed shadow-sm";
              stateLabel = isBookedByMe ? "Booked by you (payment pending)" : "Booked by another member";
              icon = <Lock className="w-3 h-3 text-rose-200" />;
              isClickable = false;
            }
          } else if (status === "HELD") {
            if (isHeldByMe) {
              bgClass = "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300 animate-pulse-subtle cursor-pointer";
              stateLabel = "Selected by you (tap to deselect)";
              icon = <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />;
              isClickable = true;
            } else {
              bgClass = "bg-amber-100 text-amber-800 border-amber-300 cursor-not-allowed opacity-80";
              stateLabel = "Held by someone else";
              icon = <Lock className="w-3 h-3 text-amber-600" />;
              isClickable = false;
            }
          }

          const formattedNumber = String(tokenNumber).padStart(2, "0");

          return (
            <button
              key={token.id}
              role="gridcell"
              aria-label={`Token ${tokenNumber}: ${stateLabel}`}
              aria-selected={isHeldByMe}
              aria-disabled={!isClickable}
              tabIndex={isClickable ? 0 : -1}
              disabled={isLoading || (!isClickable && !isHeldByMe)}
              onClick={() => onTokenClick(token)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (isClickable) onTokenClick(token);
                }
              }}
              title={`Token #${tokenNumber} • ${stateLabel}`}
              className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center transition-all select-none p-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${bgClass}`}
            >
              <span className="font-extrabold text-sm sm:text-base leading-none tracking-tight">
                {formattedNumber}
              </span>
              {icon && <span className="absolute bottom-1 right-1">{icon}</span>}
              {isAdminAssigned && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-400 border border-white" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
