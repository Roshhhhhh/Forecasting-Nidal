/**
 * Parses a narrative string into bold/text segments.
 *
 * Two modes:
 * 1. If the text already contains **bold** markers → honour those exactly.
 * 2. Legacy plain text → auto-bold AED amounts, percentages, and bedroom labels.
 */
export type NarrativeSegment = { type: "text" | "bold"; content: string };

// Patterns auto-bolded in legacy (no-marker) narratives
// Matches: "AED 109,920"  |  "80%"  |  "1-bedroom"  |  "2-bedroom"
const AUTO_BOLD = /(AED\s[\d,]+|\d+(?:\.\d+)?%|\d+-bedroom(?:\s+\w+)?)/g;

export function parseNarrative(text: string): NarrativeSegment[] {
  if (!text.trim()) return [];

  // Mode 1: explicit **markers**
  if (text.includes("**")) {
    return text.split(/\*\*([^*]+)\*\*/g).map((part, i) => ({
      type: (i % 2 === 1 ? "bold" : "text") as NarrativeSegment["type"],
      content: part,
    }));
  }

  // Mode 2: auto-bold key figures
  const segments: NarrativeSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  AUTO_BOLD.lastIndex = 0;
  while ((match = AUTO_BOLD.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "bold", content: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }
  return segments;
}
