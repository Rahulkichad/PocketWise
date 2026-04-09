import React from "react";

export default function EmptyState({
  title = "Nothing here yet",
  description = "Start by adding some data.",
  action = null,
}) {
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-white/60">
      <div className="text-lg font-semibold text-ink">{title}</div>
      <div className="text-sm text-muted mt-1">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
