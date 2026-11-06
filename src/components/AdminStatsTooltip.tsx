"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface AdminStatsTooltipProps {
  title: string;
  value: string | number;
  formula: string;
  explanation: string;
  subValue?: string;
  badge?: string;
  badgeColor?: "green" | "amber" | "red" | "purple";
}

export default function AdminStatsTooltip({
  title,
  value,
  formula,
  explanation,
  subValue,
  badge,
  badgeColor = "green",
}: AdminStatsTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const badgeClasses = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-rose-100 text-rose-800 border-rose-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
  }[badgeColor];

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between group hover:border-emerald-300 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <button
          type="button"
          aria-label={`Formula details for ${title}`}
          onClick={() => setShowTooltip(!showTooltip)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="text-slate-400 hover:text-emerald-700 p-1 rounded-md transition"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</span>
        {subValue && <span className="text-xs text-slate-500 font-medium">{subValue}</span>}
      </div>

      {badge && (
        <div className="mt-2.5">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeClasses}`}>
            {badge}
          </span>
        </div>
      )}

      {/* Popover Tooltip with exact transparent formula */}
      {showTooltip && (
        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs border border-slate-700 animate-in fade-in zoom-in-95 pointer-events-none">
          <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1">
            <span>Formula & Calculation</span>
          </div>
          <div className="bg-slate-800 p-2 rounded-lg font-mono text-[11px] text-amber-300 border border-slate-700 mb-1.5 break-words">
            {formula}
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {explanation}
          </p>
        </div>
      )}
    </div>
  );
}
