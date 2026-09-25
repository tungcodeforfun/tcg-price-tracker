import { describe, expect, it } from "vitest";
import { formatDollars, parseDollars } from "../src/money.ts";

describe("parseDollars", () => {
  it.each([
    ["12.5", 1250],
    ["12.50", 1250],
    ["0", 0],
    [" 3 ", 300],
    ["$1,200.05", 120005],
    ["0.07", 7],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parseDollars(input)).toEqual({ ok: true, cents });
  });

  it("treats blank as unknown", () => {
    expect(parseDollars("  ")).toEqual({ ok: true, cents: null });
  });

  it.each(["-1", "1.234", "abc", "1e3", "12.", ".5", "1000000.01"])("rejects %j", (input) => {
    expect(parseDollars(input).ok).toBe(false);
  });

  it("round-trips through formatDollars", () => {
    expect(formatDollars(120005)).toBe("1200.05");
    expect(parseDollars(formatDollars(7))).toEqual({ ok: true, cents: 7 });
  });
});
