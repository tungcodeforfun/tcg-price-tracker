/** Only same-origin relative paths; blocks `//evil.com`, `/\\evil.com` and absolute URLs. */
export function safeRedirect(
  target: FormDataEntryValue | string | null,
  fallback = "/app",
): string {
  if (
    typeof target !== "string" ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.startsWith("/\\")
  ) {
    return fallback;
  }
  return target;
}
