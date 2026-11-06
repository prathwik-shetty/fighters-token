"use client";

import Link from "next/link";
import { Shield, User, LogOut, Ticket, Settings } from "lucide-react";

interface HeaderProps {
  member?: {
    id: string;
    phone: string;
    name?: string | null;
    bookedCount?: number;
  } | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
}

export default function Header({ member, onOpenLogin, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#064e3b] text-white shadow-md border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-950/40 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="font-extrabold text-lg sm:text-xl tracking-tight leading-none text-emerald-50 flex items-center gap-2">
              <span>FIGHTERS TOKEN</span>
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider bg-emerald-800/80 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                Live Sale
              </span>
            </div>
            <p className="text-[11px] text-emerald-300/80 font-medium hidden sm:block">
              Official Token Reservation Platform
            </p>
          </div>
        </Link>

        {/* Right Navigation & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {member ? (
            <div className="flex items-center gap-2">
              <Link
                href="/my-tokens"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-emerald-100 bg-emerald-900/80 hover:bg-emerald-800/90 border border-emerald-700/60 rounded-lg transition"
              >
                <Ticket className="w-4 h-4 text-emerald-300" />
                <span>My Tokens</span>
                {member.bookedCount !== undefined && member.bookedCount > 0 && (
                  <span className="bg-emerald-400 text-emerald-950 text-[11px] font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                    {member.bookedCount}
                  </span>
                )}
              </Link>

              <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-emerald-200 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1.5 rounded-lg">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span className="max-w-[120px] truncate">{member.name || member.phone}</span>
              </div>

              <button
                onClick={onLogout}
                title="Log Out"
                className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-900/60 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-lg shadow-sm transition active:scale-95"
            >
              <User className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}

          {/* Admin Portal Button */}
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-emerald-200 hover:text-white bg-emerald-900/50 hover:bg-emerald-800/80 border border-emerald-700/50 rounded-lg transition"
          >
            <Settings className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Admin Portal</span>
            <span className="sm:hidden">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
