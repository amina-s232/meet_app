// Security notice: User credentials (passwords, emails, tokens) must never be logged or exposed in URLs.

/** Only allow same-site relative paths as post-login redirect targets (prevents open redirects and query leakage). */
export function safeCallbackUrl(
  value: string | string[] | undefined,
  fallback = "/dashboard"
): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || typeof v !== "string" || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) {
    return fallback;
  }
  try {
    // Only allow pathname, stripping any query string (?...) or hash (#...) to prevent user input or credentials leakage
    const url = new URL(v, "http://localhost");
    return url.pathname.startsWith("/") ? url.pathname : fallback;
  } catch {
    return fallback;
  }
}