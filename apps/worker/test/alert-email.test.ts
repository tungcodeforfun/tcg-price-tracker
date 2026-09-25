import type { PendingNotification } from "@tcg/core";
import { describe, expect, it } from "vitest";
import { alertDigestEmail } from "../src/alerts/email.ts";

const notification = (overrides: Partial<PendingNotification> = {}): PendingNotification => ({
  id: "n1",
  userId: "u1",
  email: "ash@example.com",
  userName: "Ash",
  cardSlug: "pikachu-5-12",
  cardName: "Pikachu - 5/12",
  setName: "McDonald's Promos 2014",
  condition: "Near Mint",
  printing: "Holofoil",
  direction: "below",
  thresholdCents: 4000,
  priceCents: 3850,
  attempts: 0,
  ...overrides,
});

describe("alertDigestEmail", () => {
  it("names the card and new price for a single alert", () => {
    const email = alertDigestEmail([notification()], "https://tcg.example");
    expect(email.to).toBe("ash@example.com");
    expect(email.subject).toBe("Price alert: Pikachu - 5/12 is now $38.50");
    expect(email.text).toContain("dropped to $38.50, at or below your $40.00 target");
    expect(email.text).toContain("https://tcg.example/cards/pikachu-5-12");
    expect(email.text).toContain("https://tcg.example/app/alerts");
  });

  it("lists every alert in one digest", () => {
    const email = alertDigestEmail(
      [
        notification(),
        notification({
          id: "n2",
          cardName: "Charizard",
          direction: "above",
          priceCents: 50000,
          thresholdCents: 45000,
        }),
      ],
      "https://tcg.example",
    );
    expect(email.subject).toBe("2 price alerts triggered");
    expect(email.text).toContain(
      "Charizard (Holofoil · Near Mint, McDonald's Promos 2014) rose to $500.00",
    );
  });

  it("escapes card data in the HTML body", () => {
    const email = alertDigestEmail(
      [notification({ cardName: `<img src=x onerror="alert(1)">` })],
      "https://tcg.example",
    );
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&#60;img");
  });
});
