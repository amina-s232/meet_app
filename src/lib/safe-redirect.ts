/** Only allow same-site relative paths as post-login redirect targets (prevents open redirects). */
export function safeCallbackUrl(
  value: string | string[] | undefined,
  fallback = "/dashboard"
): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}