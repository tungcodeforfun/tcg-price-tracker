import { feedback, inviteCodes, pageViews, users, type Db } from "@tcg/db";
import { createTestDb, truncateAll } from "@tcg/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  FEEDBACK_PER_HOUR,
  createInviteCodes,
  disableInviteCode,
  normalizeInviteCode,
  recordFeedback,
  recordPageView,
  redeemInviteCode,
  topPageViews,
} from "../src/beta.ts";
import { ValidationError } from "../src/portfolio-types.ts";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

beforeEach(async () => {
  await truncateAll(db);
  await db.insert(users).values({ id: "u1", name: "Ash", email: "ash@example.com" });
});

describe("invite codes", () => {
  it("generates unambiguous, grouped codes", async () => {
    const codes = await createInviteCodes(db, { count: 50 });
    expect(new Set(codes).size).toBe(50);
    for (const code of codes)
      expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  });

  it("accepts a code typed in any case, spacing or dash placement", async () => {
    const [code] = await createInviteCodes(db, { count: 1 });
    const messy = ` ${code!.toLowerCase().replaceAll("-", " ")} `;
    expect(normalizeInviteCode(messy)).toBe(code);
    expect(await redeemInviteCode(db, messy)).toBe(code);
  });

  it("allows exactly maxUses redemptions", async () => {
    const [code] = await createInviteCodes(db, { count: 1, maxUses: 2 });
    expect(await redeemInviteCode(db, code!)).toBe(code);
    expect(await redeemInviteCode(db, code!)).toBe(code);
    expect(await redeemInviteCode(db, code!)).toBeNull();
    const [row] = await db.select().from(inviteCodes);
    expect(row?.uses).toBe(2);
  });

  it("never over-redeems a code when sign-ups race for its last use", async () => {
    const [code] = await createInviteCodes(db, { count: 1, maxUses: 3 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => redeemInviteCode(db, code!)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it("rejects disabled, unknown and empty codes", async () => {
    const [code] = await createInviteCodes(db, { count: 1 });
    expect(await disableInviteCode(db, code!)).toBe(true);
    expect(await redeemInviteCode(db, code!)).toBeNull();
    expect(await redeemInviteCode(db, "AAAA-BBBB-CCCC")).toBeNull();
    expect(await redeemInviteCode(db, "  -- ")).toBeNull();
  });
});

describe("recordFeedback", () => {
  const submit = (message: string, pagePath: string | null = "/cards/pikachu") =>
    recordFeedback(db, { userId: "u1", email: "ash@example.com", message, pagePath });

  it("stores trimmed feedback with the page it came from", async () => {
    await submit("  Charts are great  ");
    expect(await db.select().from(feedback)).toMatchObject([
      {
        userId: "u1",
        email: "ash@example.com",
        message: "Charts are great",
        pagePath: "/cards/pikachu",
      },
    ]);
  });

  it("rejects empty and overlong messages", async () => {
    await expect(submit("   ")).rejects.toThrow(ValidationError);
    await expect(submit("x".repeat(2_001))).rejects.toThrow(ValidationError);
  });

  it("limits each user to a fixed number of messages per hour", async () => {
    for (let i = 0; i < FEEDBACK_PER_HOUR; i++) await submit(`note ${i}`);
    await expect(submit("one more")).rejects.toThrow(ValidationError);
    const later = new Date(Date.now() + 61 * 60_000);
    await expect(
      recordFeedback(
        db,
        { userId: "u1", email: "ash@example.com", message: "an hour later", pagePath: null },
        later,
      ),
    ).resolves.toBeTypeOf("string");
  });

  it("keeps feedback when the account is deleted", async () => {
    await submit("keep me");
    await db.delete(users);
    expect(await db.select().from(feedback)).toMatchObject([
      { userId: null, email: "ash@example.com" },
    ]);
  });
});

describe("page views", () => {
  const day = new Date("2026-09-25T12:00:00Z");

  it("counts per path and day, dropping query strings", async () => {
    await recordPageView(db, "/cards/pikachu?variant=abc", day);
    await recordPageView(db, "/cards/pikachu#history", day);
    await recordPageView(db, "/search?q=secret-query", day);
    expect(await db.select().from(pageViews).orderBy(pageViews.path)).toEqual([
      { day: "2026-09-25", path: "/cards/pikachu", views: 2 },
      { day: "2026-09-25", path: "/search", views: 1 },
    ]);
  });

  it.each(["https://evil.example/x", "//evil.example", "/api/pv", "", `/${"x".repeat(300)}`])(
    "ignores %j",
    async (path) => {
      expect(await recordPageView(db, path, day)).toBe(false);
      expect(await db.select().from(pageViews)).toEqual([]);
    },
  );

  it("ranks paths over the last N days", async () => {
    await recordPageView(db, "/old", new Date("2026-09-10T12:00:00Z"));
    for (const path of ["/a", "/b", "/b"]) await recordPageView(db, path, day);
    expect(await topPageViews(db, 7, 10, day)).toEqual([
      { path: "/b", views: 2 },
      { path: "/a", views: 1 },
    ]);
  });
});
