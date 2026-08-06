/**
 * PageTabs — Hostaway-style underline tab navigation.
 * Use at the top of a Card to switch between major views/filters.
 */
import React from "react";

export interface TabItem {
  value: string;
  label: string;
  /** Optional count badge shown beside the label */
  count?: number;
}

interface PageTabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function PageTabs({ tabs, value, onChange, className = "" }: PageTabsProps) {
  return (
    <div className={`flex items-end gap-0 border-b border-border px-2 ${className}`}>
      {tabs.map(tab => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap",
              "border-b-2 -mb-px relative",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            ].join(" ")}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={[
                  "inline-flex items-center justify-center min-w-[20px] px-1.5 h-5 rounded-full text-[11px] font-semibold leading-none",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
