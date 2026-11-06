"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Mail, KeyRound, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, totpCode: requiresTotp ? totpCode : undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      if (data.requiresTotp) {
        setRequiresTotp(true);
        setIsLoading(false);
        return;
      }

      // Success
      router.push("/admin");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Authentication failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Public Grid</span>
          </Link>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-7 sm:p-8 text-white">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Admin Portal Login</h1>
            <p className="text-xs text-slate-400 mt-1">
              Protected area for Fighters Token campaign administrators
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!requiresTotp ? (
              <>
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-slate-300 mb-1.5">
                    Admin Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@fighterstoken.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-bold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="animate-in fade-in">
                <div className="text-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Two-Factor Authentication (2FA)</h3>
                  <p className="text-xs text-slate-400">
                    Enter the 6-digit TOTP code from your authenticator app
                  </p>
                </div>

                <label htmlFor="totpCode" className="block text-xs font-bold text-slate-300 mb-1.5">
                  6-Digit 2FA Code
                </label>
                <input
                  id="totpCode"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-extrabold px-3.5 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {errorMsg && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>{requiresTotp ? "Verify 2FA & Access Dashboard" : "Sign In to Admin"}</span>
              )}
            </button>

            {requiresTotp && (
              <button
                type="button"
                onClick={() => setRequiresTotp(false)}
                className="text-xs text-slate-400 hover:text-white text-center mt-1"
              >
                Back to password login
              </button>
            )}
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/80 text-center text-[11px] text-slate-400">
            <span>Default local admin: </span>
            <code className="text-emerald-400 font-mono">admin@fighterstoken.com</code>
            <span> / </span>
            <code className="text-emerald-400 font-mono">AdminFighters@2026!</code>
          </div>
        </div>
      </div>
    </div>
  );
}
