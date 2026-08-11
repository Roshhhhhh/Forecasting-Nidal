/**
 * Extracts a human-readable error description from a caught API error.
 *
 * Priority:
 * 1. `error.data.error` — the raw `{ error: "..." }` field the server sends
 * 2. `error.message` with the "HTTP NNN Status: " prefix stripped
 * 3. `fallback`
 */
export function getApiErrorMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!e || typeof e !== "object") return fallback;
  const err = e as Record<string, any>;

  // ApiError.data is the parsed response body — prefer the server's own error field
  const dataError = err?.data?.error;
  if (typeof dataError === "string" && dataError.trim()) return dataError.trim();

  // Fall back to the error's message, stripping the HTTP prefix added by ApiError
  const msg = typeof err?.message === "string" ? err.message.trim() : "";
  if (msg) {
    const m = msg.match(/^HTTP \d{3}[^:]*: (.+)$/s);
    return m ? m[1] : msg;
  }

  return fallback;
}
