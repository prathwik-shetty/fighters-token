"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminStatsTooltip from "@/components/AdminStatsTooltip";
import { CalculatedSaleStats } from "@/services/stats";
import {
  Shield,
  LogOut,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  UserPlus,
  Snowflake,
  Sun,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  Sliders,
  History,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface AdminProfile {
  id: string;
  email: string;
  role: string;
  totpEnabled: boolean;
}

interface MemberBookingRow {
  id: string;
  name: string;
  phone: string;
  tokenNumbers: number[];
  tokenIds: string[];
  status: string;
  amount: number;
  paymentId: string | null;
  payByDate: string | null;
  createdAt: string;
  isAdminAssigned: boolean;
}

interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  details: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [stats, setStats] = useState<CalculatedSaleStats | null>(null);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "MEMBERS" | "AUDIT" | "SETTINGS">("OVERVIEW");

  // Members table state
  const [members, setMembers] = useState<MemberBookingRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  // Action Modals & States
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states for admin actions
  const [newLiveCount, setNewLiveCount] = useState<number>(80);
  const [freezeInput, setFreezeInput] = useState("");
  const [unfreezeInput, setUnfreezeInput] = useState("");
  const [assignName, setAssignName] = useState("");
  const [assignCount, setAssignCount] = useState<number>(1);
  const [assignedResultTokens, setAssignedResultTokens] = useState<number[] | null>(null);

  // Auto assign rule settings
  const [autoAssignThreshold, setAutoAssignThreshold] = useState<number>(10.0);
  const [autoAssignK, setAutoAssignK] = useState<number>(1);
  const [autoAssignTarget, setAutoAssignTarget] = useState("Patron Member");

  // Settings form
  const [settingsTitle, setSettingsTitle] = useState("Fighters Token Sale 2026");
  const [settingsPrice, setSettingsPrice] = useState<number>(1000);
  const [settingsHoldSeconds, setSettingsHoldSeconds] = useState<number>(180);
  const [settingsPayByDays, setSettingsPayByDays] = useState<number>(7);
  const [settingsLimit, setSettingsLimit] = useState<number>(5);

  // Fetch admin session
  const fetchAdminSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/me");
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        router.push("/admin/login");
        return;
      }
      setAdmin(data.admin);
    } catch {
      router.push("/admin/login");
    }
  }, [router]);

  // Fetch live tokens & stats
  const fetchStatsAndSale = useCallback(async () => {
    try {
      const res = await fetch("/api/tokens");
      const data = await res.json();
      if (data.sale) {
        setSaleId(data.sale.id);
        setPaymentsOpen(data.sale.paymentsOpen);
        setNewLiveCount(data.sale.totalTokens);
        setSettingsTitle(data.sale.title);
        setSettingsPrice(data.sale.pricePerToken);
        setSettingsHoldSeconds(data.sale.holdDurationSeconds);
      }
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("fetchStats error:", err);
    }
  }, []);

  // Fetch members & bookings
  const fetchMembers = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (searchQuery) query.append("search", searchQuery);
      if (statusFilter !== "ALL") query.append("status", statusFilter);

      const res = await fetch(`/api/admin/members?${query.toString()}`);
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error("fetchMembers error:", err);
    }
  }, [searchQuery, statusFilter]);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      const data = await res.json();
      if (data.logs) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error("fetchAuditLogs error:", err);
    }
  }, []);

  useEffect(() => {
    fetchAdminSession();
    fetchStatsAndSale();
    fetchMembers();
    fetchAuditLogs();
  }, [fetchAdminSession, fetchStatsAndSale, fetchMembers, fetchAuditLogs]);

  // Handle Logout
  const handleLogout = async () => {
    await fetch("/api/admin/me", { method: "POST" });
    router.push("/admin/login");
  };

  // Toggle Payments
  const handleTogglePayments = async (force = false) => {
    if (!saleId) return;
    setIsProcessingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/admin/payments/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId, open: !paymentsOpen, forceOverride: force }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresWarningConfirmation) {
          setWarningMessage(data.warning);
          setShowWarningModal(true);
          return;
        }
        throw new Error(data.error || "Failed to toggle payments.");
      }

      setPaymentsOpen(data.paymentsOpen);
      setShowWarningModal(false);
      setNotification({
        type: "success",
        message: data.message,
      });
      fetchStatsAndSale();
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Error updating payments status.",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper to parse comma / dash range inputs (e.g. "1-5, 8, 12")
  const parseTokenInput = (input: string): number[] => {
    const numbers = new Set<number>();
    const parts = input.split(",");
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;
      if (clean.includes("-")) {
        const [startStr, endStr] = clean.split("-");
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          for (let i = min; i <= max; i++) numbers.add(i);
        }
      } else {
        const num = parseInt(clean, 10);
        if (!isNaN(num)) numbers.add(num);
      }
    }
    return Array.from(numbers).sort((a, b) => a - b);
  };

  // Handle Freeze
  const handleFreezeTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId) return;
    const tokenNumbers = parseTokenInput(freezeInput);
    if (tokenNumbers.length === 0) return;

    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/admin/tokens/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId, tokenNumbers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to freeze tokens.");

      setNotification({ type: "success", message: data.message });
      setFreezeInput("");
      fetchStatsAndSale();
      fetchAuditLogs();
    } catch (err: unknown) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Error freezing tokens." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Unfreeze
  const handleUnfreezeTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId) return;
    const tokenNumbers = parseTokenInput(unfreezeInput);
    if (tokenNumbers.length === 0) return;

    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/admin/tokens/unfreeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId, tokenNumbers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unfreeze tokens.");

      setNotification({ type: "success", message: data.message });
      setUnfreezeInput("");
      fetchStatsAndSale();
      fetchAuditLogs();
    } catch (err: unknown) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Error unfreezing tokens." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Set Count
  const handleSetCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId) return;

    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/admin/tokens/set-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId, newCount: Number(newLiveCount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update token count.");

      setNotification({ type: "success", message: data.message });
      fetchStatsAndSale();
      fetchAuditLogs();
    } catch (err: unknown) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Error updating count." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Book on Behalf
  const handleAdminAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId) return;

    setIsProcessingAction(true);
    setAssignedResultTokens(null);
    try {
      const res = await fetch("/api/admin/tokens/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          recipientName: assignName,
          count: Number(assignCount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to allocate tokens.");

      setAssignedResultTokens(data.assignedTokens);
      setNotification({
        type: "success",
        message: `Allocated ${data.assignedTokens.length} tokens to ${data.recipientName}: #${data.assignedTokens.join(", #")}`,
      });
      setAssignName("");
      fetchStatsAndSale();
      fetchMembers();
      fetchAuditLogs();
    } catch (err: unknown) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Allocation error." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle 10% Auto Assign Trigger
  const handleAutoAssignRule = async (triggerNow = false) => {
    if (!saleId) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/admin/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          thresholdPercent: Number(autoAssignThreshold),
          kTokens: Number(autoAssignK),
          targetName: autoAssignTarget,
          triggerNow,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to configure rule.");

      setNotification({
        type: "success",
        message: triggerNow
          ? `Rule executed! Assigned tokens: #${data.triggeredResult?.assignedTokens?.join(", #") || "None (threshold not met)"}`
          : "Auto-assignment threshold rule saved.",
      });
      fetchStatsAndSale();
      fetchAuditLogs();
    } catch (err: unknown) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Failed to trigger auto-assign." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Refund
  const handleRefund = async (bookingId: string) => {
    const reason = prompt("Enter reason for Razorpay refund:", "Admin manual refund");
    if (!reason) return;

    setIsProcessingAction(true);
    try {
      const res = await fetch("/api/admin/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process refund.");

      setNotification({ type: "success", message: data.message });
      fetchStatsAndSale();
      fetchMembers();
      fetchAuditLogs();
    } catch (err: unknown) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Refund failed." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleId) return;
    setIsProcessingAction(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId,
          title: settingsTitle,
          pricePerToken: Number(settingsPrice),
          maxTokensPerMember: Number(settingsLimit),
          holdDurationSeconds: Number(settingsHoldSeconds),
          payByDeadlineDays: Number(settingsPayByDays),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings.");

      setNotification({ type: "success", message: data.message });
      fetchStatsAndSale();
      fetchAuditLogs();
    } catch (err: unknown) {
      setNotification({ type: "error", message: err instanceof Error ? err.message : "Error saving settings." });
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Admin Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-md">
                <Shield className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block leading-none">
                  Fighters Token
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  Admin Portal
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{admin?.email}</span>
            </div>

            <button
              onClick={() => {
                fetchStatsAndSale();
                fetchMembers();
                fetchAuditLogs();
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 text-rose-400 hover:text-rose-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 border-t border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "OVERVIEW"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Live Overview & Controls
          </button>
          <button
            onClick={() => setActiveTab("MEMBERS")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "MEMBERS"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Members & Bookings ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("AUDIT")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "AUDIT"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Audit Log Trail
          </button>
          <button
            onClick={() => setActiveTab("SETTINGS")}
            className={`py-3 px-4 border-b-2 transition ${
              activeTab === "SETTINGS"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Campaign Settings
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Notifications */}
        {notification && (
          <div
            className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : "bg-rose-50 border-rose-300 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
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

        {/* TAB 1: OVERVIEW & CONTROLS */}
        {activeTab === "OVERVIEW" && stats && (
          <div className="flex flex-col gap-6">
            {/* Top Gating Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    paymentsOpen
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {paymentsOpen ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Payment Gateway Status:{" "}
                    <span className={paymentsOpen ? "text-emerald-700 font-extrabold" : "text-amber-700 font-extrabold"}>
                      {paymentsOpen ? "OPEN & ACTIVE" : "LOCKED (GATED)"}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {paymentsOpen
                      ? "Members can now pay with Razorpay (UPI, GPay, Cards, Netbanking)."
                      : "Payments unlock when all tokens are booked or via manual admin override."}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleTogglePayments(false)}
                disabled={isProcessingAction}
                className={`py-2.5 px-5 font-bold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 shrink-0 ${
                  paymentsOpen
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {paymentsOpen ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Close Payments</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Open Payments Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Transparent Live Stats Panel with Info Tooltips */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                  Live Transparent Stats & Formulas
                </h3>
                <span className="text-xs text-slate-400">
                  Hover over ⓘ to view exact formulas and variables
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                <AdminStatsTooltip
                  title="Total Live Tokens"
                  value={stats.totalLiveTokens.value}
                  formula={stats.totalLiveTokens.formula}
                  explanation={stats.totalLiveTokens.explanation}
                  subValue={`Grid capacity (1..${stats.totalLiveTokens.value})`}
                />

                <AdminStatsTooltip
                  title="Frozen Tokens"
                  value={stats.frozenCount.value}
                  formula={stats.frozenCount.formula}
                  explanation={stats.frozenCount.explanation}
                  badge={stats.frozenCount.value > 0 ? "Blocked" : "None"}
                  badgeColor="amber"
                />

                <AdminStatsTooltip
                  title="Available Tokens"
                  value={stats.availableCount.value}
                  formula={stats.availableCount.formula}
                  explanation={stats.availableCount.explanation}
                  badge="Free to book"
                  badgeColor="green"
                />

                <AdminStatsTooltip
                  title="Member Booked (Unpaid)"
                  value={stats.memberBookedCount.value}
                  formula={stats.memberBookedCount.formula}
                  explanation={stats.memberBookedCount.explanation}
                  subValue="Pending payment"
                  badgeColor="red"
                />

                <AdminStatsTooltip
                  title="Admin-Assigned"
                  value={stats.adminAssignedCount.value}
                  formula={stats.adminAssignedCount.formula}
                  explanation={stats.adminAssignedCount.explanation}
                  subValue="Designated names"
                  badgeColor="purple"
                />

                <AdminStatsTooltip
                  title="Paid Tokens"
                  value={stats.paidCount.value}
                  formula={stats.paidCount.formula}
                  explanation={stats.paidCount.explanation}
                  badge="Verified"
                  badgeColor="green"
                />

                <AdminStatsTooltip
                  title="Percentage Booked"
                  value={stats.percentageBooked.formattedPercentage}
                  formula={stats.percentageBooked.formula}
                  explanation={stats.percentageBooked.calculationSteps}
                  badge={stats.allTokensBooked ? "100% Booked" : `${stats.totalBookedAndAssigned.value}/${stats.effectiveTokens.value}`}
                  badgeColor={stats.allTokensBooked ? "green" : "amber"}
                />

                <AdminStatsTooltip
                  title="10% Threshold Check"
                  value={stats.thresholdCheck.thresholdMet ? "MET (YES)" : "PENDING (NO)"}
                  formula={stats.thresholdCheck.formula}
                  explanation={stats.thresholdCheck.displaySummary}
                  badge={`${stats.thresholdCheck.currentBookedCount}/${stats.thresholdCheck.requiredTokens} req`}
                  badgeColor={stats.thresholdCheck.thresholdMet ? "green" : "amber"}
                />

                <AdminStatsTooltip
                  title="Revenue Expected"
                  value={stats.revenue.expected.formattedValue}
                  formula={stats.revenue.expected.formula}
                  explanation={stats.revenue.expected.explanation}
                />

                <AdminStatsTooltip
                  title="Revenue Collected"
                  value={stats.revenue.collected.formattedValue}
                  formula={stats.revenue.collected.formula}
                  explanation={stats.revenue.collected.explanation}
                  badge="Captured"
                  badgeColor="green"
                />

                <AdminStatsTooltip
                  title="Revenue Pending"
                  value={stats.revenue.pending.formattedValue}
                  formula={stats.revenue.pending.formula}
                  explanation={stats.revenue.pending.explanation}
                  badge="Awaiting pay"
                  badgeColor="red"
                />

                <AdminStatsTooltip
                  title="Refunds Issued"
                  value={stats.refunds.amount.formattedValue}
                  formula={stats.refunds.amount.formula}
                  explanation={`${stats.refunds.count.value} processed refund(s)`}
                  badge={`${stats.refunds.count.value} refunds`}
                  badgeColor="amber"
                />
              </div>
            </div>

            {/* Action Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Tool 1: Book on Behalf of Someone */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-slate-800">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-sm">Book on Behalf of Someone</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Randomly picks N available non-frozen tokens and designates them as ADMIN-ASSIGNED.
                  </p>

                  <form onSubmit={handleAdminAssign} className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        required
                        value={assignName}
                        onChange={(e) => setAssignName(e.target.value)}
                        placeholder="e.g. VIP Patron / Guest"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Count of Tokens (N)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        required
                        value={assignCount}
                        onChange={(e) => setAssignCount(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessingAction || !assignName.trim()}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      Assign Random Tokens
                    </button>
                  </form>

                  {assignedResultTokens && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
                      <span className="font-bold block mb-1">Assigned Token Numbers:</span>
                      <span className="font-mono text-sm font-extrabold text-purple-700">
                        #{assignedResultTokens.join(", #")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool 2: Freeze / Unfreeze Tokens */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-slate-800">
                    <Snowflake className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-sm">Freeze / Unfreeze Tokens</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Block tokens (grey) or release them. Supports numbers & ranges like <code>1-5, 8, 12</code>.
                  </p>

                  <form onSubmit={handleFreezeTokens} className="flex flex-col gap-2 mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={freezeInput}
                        onChange={(e) => setFreezeInput(e.target.value)}
                        placeholder="e.g. 1-10 or 15, 20"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isProcessingAction || !freezeInput.trim()}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shrink-0"
                      >
                        Freeze
                      </button>
                    </div>
                  </form>

                  <form onSubmit={handleUnfreezeTokens} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={unfreezeInput}
                        onChange={(e) => setUnfreezeInput(e.target.value)}
                        placeholder="e.g. 1-10 or 15, 20"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isProcessingAction || !unfreezeInput.trim()}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shrink-0 flex items-center gap-1"
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>Unfreeze</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Tool 3: Set Live Token Count & 10% Auto Assign */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-slate-800">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h4 className="font-bold text-sm">Grid Count & 10% Rule</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Adjust live token grid capacity (e.g. 80) and configure cryptographic auto-allocation.
                  </p>

                  {/* Set Token Count */}
                  <form onSubmit={handleSetCount} className="flex gap-2 mb-4">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={newLiveCount}
                      onChange={(e) => setNewLiveCount(Number(e.target.value))}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isProcessingAction}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
                    >
                      Update Total Tokens
                    </button>
                  </form>

                  {/* 10% Rule Trigger */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">10% Auto-Assign Rule</span>
                      <span className="text-[10px] text-slate-400">crypto.randomInt RNG</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={autoAssignTarget}
                        onChange={(e) => setAutoAssignTarget(e.target.value)}
                        placeholder="Target Name"
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAutoAssignRule(true)}
                        disabled={isProcessingAction}
                        className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shrink-0"
                      >
                        Trigger Rule
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEMBERS & BOOKINGS LIST */}
        {activeTab === "MEMBERS" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Member Bookings & Allocations</h3>
                <p className="text-xs text-slate-500">
                  Search, verify payment status, trigger Razorpay refunds, or export to CSV.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/admin/members/export"
                  download
                  className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export to CSV</span>
                </a>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by member name, WhatsApp number, or token #..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending Payment</option>
                <option value="ADMIN_ASSIGNED">Admin Assigned</option>
              </select>
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Member / Recipient</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Token Numbers</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No member bookings match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    members.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{row.name}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{row.phone}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {row.tokenNumbers.map((num) => (
                              <span
                                key={num}
                                className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[11px]"
                              >
                                #{num}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              row.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.status === "ADMIN_ASSIGNED"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {row.amount > 0 ? `₹${row.amount.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {row.paymentId || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {row.status === "PAID" && row.paymentId && (
                            <button
                              onClick={() => handleRefund(row.id)}
                              className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Refund</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOG TRAIL */}
        {activeTab === "AUDIT" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Cryptographic Audit Trail</h3>
              </div>
              <span className="text-xs text-slate-400">Last 100 system & admin actions</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Payload Details / Cryptographic Inputs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">{log.actor}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xl truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === "SETTINGS" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-2xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Sliders className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-base text-slate-900">Campaign Parameters & Rules</h3>
            </div>

            <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sale Title
                </label>
                <input
                  type="text"
                  required
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price Per Token (INR)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={settingsPrice}
                    onChange={(e) => setSettingsPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Max Tokens Per Member
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={settingsLimit}
                    onChange={(e) => setSettingsLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Selection Hold Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min={120}
                    max={180}
                    required
                    value={settingsHoldSeconds}
                    onChange={(e) => setSettingsHoldSeconds(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">Configurable between 120 and 180s</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pay-By Deadline (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={settingsPayByDays}
                    onChange={(e) => setSettingsPayByDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">Default 7 days</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessingAction}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow transition mt-2"
              >
                Save Settings
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Confirmation Warning Modal for Early Payment Opening */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-2">
              Warning: Early Payment Opening
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {warningMessage}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleTogglePayments(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Yes, Open Payments Early
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
