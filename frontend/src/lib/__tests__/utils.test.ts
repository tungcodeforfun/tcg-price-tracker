import { describe, it, expect } from "vitest";
import {
  cn,
  formatPrice,
  formatDate,
  formatPercent,
  formatRelativeTime,
  TCG_LABELS,
  CONDITION_LABELS,
} from "../utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const isHidden = false;
    expect(cn("base", isHidden && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});

describe("formatPrice", () => {
  it("formats a number as USD currency", () => {
    expect(formatPrice(29.99)).toBe("$29.99");
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("returns N/A for null", () => {
    expect(formatPrice(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatPrice(undefined)).toBe("N/A");
  });

  it("formats large numbers with commas", () => {
    expect(formatPrice(1234.5)).toBe("$1,234.50");
  });
});

describe("formatDate", () => {
  it("formats an ISO date string", () => {
    const result = formatDate("2024-03-15T10:30:00Z");
    expect(result).toBe("Mar 15, 2024");
  });
});

describe("formatPercent", () => {
  it("formats a positive percentage with + sign", () => {
    expect(formatPercent(12.345)).toBe("+12.35%");
  });

  it("formats a negative percentage", () => {
    expect(formatPercent(-5.1)).toBe("-5.10%");
  });

  it("formats zero with + sign", () => {
    expect(formatPercent(0)).toBe("+0.00%");
  });

  it("returns N/A for null", () => {
    expect(formatPercent(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatPercent(undefined)).toBe("N/A");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 min ago");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe("2 hours ago");
  });

  it("returns singular hour", () => {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe("1 hour ago");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3 days ago");
  });

  it("returns months ago", () => {
    const twoMonthsAgo = new Date(Date.now() - 61 * 86400_000).toISOString();
    expect(formatRelativeTime(twoMonthsAgo)).toBe("2 months ago");
  });
});

describe("label maps", () => {
  it("has all TCG types", () => {
    expect(Object.keys(TCG_LABELS)).toEqual([
      "pokemon",
      "onepiece",
      "magic",
      "yugioh",
      "lorcana",
      "digimon",
    ]);
  });

  it("has all card conditions", () => {
    expect(Object.keys(CONDITION_LABELS)).toEqual([
      "mint",
      "near_mint",
      "lightly_played",
      "moderately_played",
      "heavily_played",
      "damaged",
      "poor",
    ]);
  });

  it("maps pokemon to display label", () => {
    expect(TCG_LABELS.pokemon).toBe("Pokemon");
  });

  it("maps near_mint to display label", () => {
    expect(CONDITION_LABELS.near_mint).toBe("Near Mint");
  });
});
