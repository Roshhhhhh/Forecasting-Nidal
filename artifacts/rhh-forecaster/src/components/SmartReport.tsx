/**
 * SmartReport — Hostaway-style collapsible KPI metric cards.
 * Shows a horizontal scrollable row of key figures above data tables.
 */
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface Metric {
  /** Lucide icon or any React node */
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  /** Optional small text below the value */
  subtitle?: string;
  color?: "default" | "green" | "amber" | "red" | "blue";
}

interface SmartReportProps {
  metrics: Metric[];
  className?: string;
  title?: string;
  /** Start collapsed. Default false. */
  defaultCollapsed?: boolean;
}

const colorMap: Record<string, string> = {
  default: "text-foreground",
  green:   "text-green-600",
  amber:   "text-amber-600",
  red:     "text-red-600",
  blue:    "text-blue-600",
};

export function SmartReport({
  metrics,
  className = "",
  title = "Metrics",
  defaultCollapsed = false,
}: SmartReportProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={className}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          {title}
          {collapsed
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </button>
      </div>

      {/* Metric cards */}
      {!collapsed && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="flex-shrink-0 bg-background border border-border/60 rounded-xl px-5 py-3.5 min-w-[148px] hover:border-primary/40 hover:shadow-sm transition-all cursor-default"
            >
              {m.icon && (
                <div className="text-muted-foreground mb-2 opacity-50">{m.icon}</div>
              )}
              <div className={`text-2xl font-bold tracking-tight ${colorMap[m.color ?? "default"]}`}>
                {m.value}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 font-medium leading-snug">
                {m.label}
              </div>
              {m.subtitle && (
                <div className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">
                  {m.subtitle}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
