import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("keeps same-origin paths with query strings", () => {
    expect(safeRedirect("/app/collection?sort=value")).toBe("/app/collection?sort=value");
  });

  it.each([
    ["protocol-relative URL", "//evil.com/app"],
    ["backslash host", "/\\evil.com"],
    ["absolute URL", "https://evil.com"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "app"],
    ["empty string", ""],
    ["missing value", null],
  ])("falls back for %s", (_, target) => {
    expect(safeRedirect(target)).toBe("/app");
  });

  it("uses the provided fallback", () => {
    expect(safeRedirect(null, "/")).toBe("/");
  });
});
