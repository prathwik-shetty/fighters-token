"use client";

import { useState } from "react";
import { X, Phone, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (member: { id: string; phone: string; name?: string | null }) => void;
}

export default function OtpModal({ isOpen, onClose, onSuccess }: OtpModalProps) {
  const [countryCode, setCountryCode] = useState<"+91" | "+971">("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send OTP.");
      }

      setStep("OTP");
      if (data.demoOtp) {
        setDemoCode(data.demoOtp);
        // Pre-fill demo OTP for fast testing
        setOtp(data.demoOtp);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to send OTP.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, countryCode, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify OTP.");
      }

      onSuccess(data.member);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to verify OTP.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#064e3b] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Phone className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">WhatsApp Login</h3>
              <p className="text-xs text-emerald-200">Fast & secure OTP authentication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === "PHONE" ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              {/* Country Code Toggle: India +91 / UAE +971 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Country
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setCountryCode("+91");
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                      countryCode === "+91"
                        ? "bg-white text-emerald-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="text-base">🇮🇳</span>
                    <span>India (+91)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCountryCode("+971");
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                      countryCode === "+971"
                        ? "bg-white text-emerald-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="text-base">🇦🇪</span>
                    <span>UAE (+971)</span>
                  </button>
                </div>
              </div>

              {/* Phone input */}
              <div>
                <label htmlFor="phoneNumber" className="block text-xs font-bold text-slate-700 mb-1.5">
                  WhatsApp Number
                </label>
                <div className="flex rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 overflow-hidden bg-white">
                  <span className="inline-flex items-center px-3 text-xs font-bold text-slate-500 bg-slate-50 border-r border-slate-200">
                    {countryCode}
                  </span>
                  <input
                    id="phoneNumber"
                    type="tel"
                    required
                    autoFocus
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={countryCode === "+91" ? "98765 43210" : "50 123 4567"}
                    className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  We will send a 6-digit OTP code to verify your WhatsApp account.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !phone.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <span>Send WhatsApp OTP</span>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="text-center pb-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Enter Verification Code</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code sent to <span className="font-semibold text-slate-700">{countryCode} {phone}</span>
                </p>
              </div>

              {/* Demo OTP Helper Notice */}
              {demoCode && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Demo mode test OTP: <strong>{demoCode}</strong></span>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="otpCode" className="block text-xs font-bold text-slate-700 mb-1.5">
                  6-Digit OTP
                </label>
                <input
                  id="otpCode"
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-extrabold px-3.5 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
                />
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify & Login</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("PHONE");
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-500 hover:text-emerald-700 font-medium text-center"
              >
                Change phone number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
