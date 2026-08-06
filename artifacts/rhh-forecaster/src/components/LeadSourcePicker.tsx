/**
 * LeadSourcePicker
 *
 * Two-step lead source selection:
 * 1. Top-level Select: Direct · Social Media · Referrals · Other
 * 2. If "Social Media" is chosen, an inline platform grid slides in below.
 *
 * The value written to the form is always the full `social_media_<platform>`
 * string (or the direct top-level value for non-social entries), keeping it
 * fully backward-compatible with existing data.
 */

import { useState } from "react";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ── Platform data ─────────────────────────────────────────────────────────────

const PLATFORMS: { value: string; label: string; icon: string }[] = [
  { value: "instagram",  label: "Instagram",   icon: "📸" },
  { value: "facebook",   label: "Facebook",    icon: "👥" },
  { value: "x",         label: "X (Twitter)", icon: "𝕏" },
  { value: "whatsapp",   label: "WhatsApp",    icon: "💬" },
  { value: "tiktok",     label: "TikTok",      icon: "🎵" },
  { value: "youtube",    label: "YouTube",     icon: "▶️" },
  { value: "linkedin",   label: "LinkedIn",    icon: "💼" },
  { value: "snapchat",   label: "Snapchat",    icon: "👻" },
  { value: "telegram",   label: "Telegram",    icon: "✈️" },
  { value: "threads",    label: "Threads",     icon: "🧵" },
  { value: "pinterest",  label: "Pinterest",   icon: "📌" },
  { value: "reddit",     label: "Reddit",      icon: "🤖" },
  { value: "bereal",     label: "BeReal",      icon: "📷" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTopLevel(value: string): string {
  if (!value) return "";
  if (value.startsWith("social_media_")) return "social_media";
  return value;
}

function getPlatform(value: string): string {
  if (value.startsWith("social_media_")) return value.slice("social_media_".length);
  return "";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LeadSourcePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function LeadSourcePicker({
  value,
  onChange,
  placeholder = "Where did they come from?",
}: LeadSourcePickerProps) {
  const topLevel = getTopLevel(value);
  const platform = getPlatform(value);

  function handleTopLevelChange(newTop: string) {
    if (newTop === "social_media") {
      // Don't write a value yet — wait for platform selection
      onChange("social_media");
    } else {
      onChange(newTop);
    }
  }

  function handlePlatformSelect(p: string) {
    onChange(`social_media_${p}`);
  }

  // Display label for the trigger
  const triggerLabel = (() => {
    if (!value) return undefined;
    if (value === "social_media") return "Social Media";
    if (value.startsWith("social_media_")) {
      const found = PLATFORMS.find(p => p.value === platform);
      return found ? `${found.icon} ${found.label}` : "Social Media";
    }
    return undefined; // SelectValue handles the rest
  })();

  const showPlatformPicker = topLevel === "social_media";

  return (
    <div className="space-y-2">
      {/* ── Primary select ── */}
      <Select onValueChange={handleTopLevelChange} value={topLevel}>
        <SelectTrigger>
          {triggerLabel
            ? <span className="flex items-center gap-1.5">{triggerLabel}</span>
            : <SelectValue placeholder={placeholder} />}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Direct</SelectLabel>
            <SelectItem value="direct_call">Direct Call</SelectItem>
            <SelectItem value="website">Website Inquiry</SelectItem>
            <SelectItem value="google_search">Google Search</SelectItem>
            <SelectItem value="walk_in">Walk-In</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Social Media</SelectLabel>
            <SelectItem value="social_media">Social Media ›</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Referrals</SelectLabel>
            <SelectItem value="referral">Referred by a Referee</SelectItem>
            <SelectItem value="existing_owner">Existing RHH Owner</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Other</SelectLabel>
            <SelectItem value="agent">Real Estate Agent</SelectItem>
            <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
            <SelectItem value="guest_staying">Guest Staying With Us</SelectItem>
            <SelectItem value="ai_suggested">AI Suggested</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* ── Platform grid — shown only when Social Media is selected ── */}
      {showPlatformPicker && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 p-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
            Select platform
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePlatformSelect(p.value)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
                  border transition-all text-left
                  ${platform === p.value
                    ? "border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 shadow-sm"
                    : "border-border bg-background hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-foreground"
                  }
                `}
              >
                <span>{p.icon}</span>
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
          {platform && (
            <button
              type="button"
              onClick={() => onChange("social_media")}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear platform
            </button>
          )}
        </div>
      )}
    </div>
  );
}
