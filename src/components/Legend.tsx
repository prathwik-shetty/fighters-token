"use client";

export default function Legend() {
  const items = [
    {
      label: "Available",
      description: "Free to select",
      className: "bg-emerald-100 border-emerald-400 text-emerald-900",
    },
    {
      label: "Selected",
      description: "Held in your cart (180s)",
      className: "bg-amber-500 border-amber-600 text-white shadow-sm ring-2 ring-amber-300",
    },
    {
      label: "Booked",
      description: "Payment pending",
      className: "bg-rose-500 border-rose-600 text-white",
    },
    {
      label: "Paid",
      description: "Verified & confirmed",
      className: "bg-emerald-600 border-emerald-700 text-white font-bold",
    },
    {
      label: "Frozen",
      description: "Blocked by admin",
      className: "bg-slate-200 border-slate-300 text-slate-400 line-through",
    },
    {
      label: "Admin-Assigned",
      description: "Designated allocation",
      className: "bg-purple-600 border-purple-700 text-white",
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-3 sm:p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
        Token Status Legend
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span
              className={`w-6 h-6 rounded-md border flex items-center justify-center font-bold text-[11px] shrink-0 ${item.className}`}
            >
              80
            </span>
            <div className="min-w-0">
              <span className="font-semibold text-slate-800 block truncate">{item.label}</span>
              <span className="text-[10px] text-slate-400 block truncate">{item.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
