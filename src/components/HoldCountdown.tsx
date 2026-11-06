"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface HoldCountdownProps {
  expiresAt: string | null;
  heldTokenCount: number;
  onExpire?: () => void;
}

export default function HoldCountdown({ expiresAt, heldTokenCount, onExpire }: HoldCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsRemaining(null);
      return;
    }

    const targetTime = new Date(expiresAt).getTime();

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setSecondsRemaining(diff);

      if (diff === 0 && onExpire) {
        onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (secondsRemaining === null || heldTokenCount === 0) {
    return null;
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isUrgent = secondsRemaining <= 30;

  return (
    <div
      className={`rounded-xl p-3 sm:p-4 border transition-all ${
        isUrgent
          ? "bg-rose-50 border-rose-300 text-rose-900 animate-pulse"
          : "bg-amber-50 border-amber-300 text-amber-900"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isUrgent ? (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div>
            <div className="text-xs sm:text-sm font-bold">
              {heldTokenCount} token{heldTokenCount > 1 ? "s" : ""} currently held in your cart
            </div>
            <p className="text-[11px] sm:text-xs opacity-90">
              {secondsRemaining > 0
                ? "Complete your name and confirm before hold expires."
                : "Hold has expired. Tokens returned to available."}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div
            className={`font-mono font-extrabold text-base sm:text-xl px-2.5 py-1 rounded-lg border ${
              isUrgent
                ? "bg-rose-600 text-white border-rose-700"
                : "bg-amber-500 text-white border-amber-600"
            }`}
          >
            {formattedTime}
          </div>
        </div>
      </div>
    </div>
  );
}
