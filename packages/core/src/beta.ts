import { randomInt } from "node:crypto";
import { feedback, inviteCodes, pageViews, users, type Db } from "@tcg/db";
import { and, count, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import { ValidationError } from "./portfolio-types.ts";

/** No 0/O, 1/I/L: codes are read aloud and typed from screenshots. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_GROUPS = 3;
const CODE_GROUP_LENGTH = 4;

export const MAX_FEEDBACK_LENGTH = 2_000;
export const FEEDBACK_PER_HOUR = 10;
const MAX_PATH_LENGTH = 200;

/** Case- and whitespace-insensitive, so "abcd efgh ijkl" matches "ABCD-EFGH-IJKL". */
export function normalizeInviteCode(input: string): string {
  const compact = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const groups = compact.match(new RegExp(`.{1,${CODE_GROUP_LENGTH}}`, "g")) ?? [];
  return groups.join("-");
}

export function generateInviteCode(): string {
  return Array.from({ length: CODE_GROUPS }, () =>
    Array.from(
      { length: CODE_GROUP_LENGTH },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    ).join(""),
  ).join("-");
}

export interface InviteCode {
  code: string;
  maxUses: number;
  uses: number;
  note: string | null;
  disabledAt: Date | null;
  createdAt: Date;
}

export async function createInviteCodes(
  db: Db,
  options: { count: number; maxUses?: number; note?: string | null },
): Promise<string[]> {
  const maxUses = options.maxUses ?? 1;
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 1_000) {
    throw new ValidationError("Create between 1 and 1,000 codes at a time");
  }
  if (!Number.isInteger(maxUses) || maxUses < 1)
    throw new ValidationError("Each code needs at least one use");
  const codes = Array.from({ length: options.count }, generateInviteCode);
  const inserted = await db
    .insert(inviteCodes)
    .values(codes.map((code) => ({ code, maxUses, note: options.note ?? null })))
    .onConflictDoNothing()
    .returning({ code: inviteCodes.code });
  return inserted.map((row) => row.code);
}

export async function listInviteCodes(db: Db): Promise<InviteCode[]> {
  return db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
}

export async function disableInviteCode(db: Db, code: string): Promise<boolean> {
  const updated = await db
    .update(inviteCodes)
    .set({ disabledAt: new Date() })
    .where(and(eq(inviteCodes.code, normalizeInviteCode(code)), isNull(inviteCodes.disabledAt)))
    .returning({ code: inviteCodes.code });
  return updated.length > 0;
}

/**
 * Consumes one use of a code in a single conditional UPDATE, so two sign-ups racing for a
 * code's last use can't both succeed. Returns the normalized code, or null if it isn't usable.
 */
export async function redeemInviteCode(db: Db, input: string): Promise<string | null> {
  const code = normalizeInviteCode(input);
  if (!code) return null;
  const [row] = await db
    .update(inviteCodes)
    .set({ uses: sql`${inviteCodes.uses} + 1` })
    .where(
      and(
        eq(inviteCodes.code, code),
        isNull(inviteCodes.disabledAt),
        lt(inviteCodes.uses, inviteCodes.maxUses),
      ),
    )
    .returning({ code: inviteCodes.code });
  return row?.code ?? null;
}

export async function countUsers(db: Db): Promise<number> {
  const [row] = await db.select({ total: count() }).from(users);
  return row?.total ?? 0;
}

export async function recordFeedback(
  db: Db,
  input: { userId: string; email: string; message: string; pagePath: string | null },
  now: Date = new Date(),
): Promise<string> {
  const message = input.message.trim();
  if (!message) throw new ValidationError("Write a message first");
  if (message.length > MAX_FEEDBACK_LENGTH) {
    throw new ValidationError(
      `Keep it under ${MAX_FEEDBACK_LENGTH.toLocaleString("en-US")} characters`,
    );
  }
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const [recent] = await db
    .select({ total: count() })
    .from(feedback)
    .where(and(eq(feedback.userId, input.userId), gt(feedback.createdAt, hourAgo)));
  if ((recent?.total ?? 0) >= FEEDBACK_PER_HOUR) {
    throw new ValidationError("That's a lot of feedback for one hour. Try again later.");
  }
  const [row] = await db
    .insert(feedback)
    .values({
      userId: input.userId,
      email: input.email,
      message,
      pagePath: input.pagePath?.slice(0, MAX_PATH_LENGTH) || null,
      createdAt: now,
    })
    .returning({ id: feedback.id });
  return row!.id;
}

/** Only same-site paths are counted; query strings are dropped so ids in them aren't stored. */
export function normalizeViewPath(input: string): string | null {
  if (!input.startsWith("/") || input.startsWith("//")) return null;
  const path = input.split(/[?#]/, 1)[0]!;
  if (path.startsWith("/api/") || path.length > MAX_PATH_LENGTH) return null;
  return path;
}

export async function recordPageView(
  db: Db,
  input: string,
  now: Date = new Date(),
): Promise<boolean> {
  const path = normalizeViewPath(input);
  if (!path) return false;
  await db
    .insert(pageViews)
    .values({ day: now.toISOString().slice(0, 10), path, views: 1 })
    .onConflictDoUpdate({
      target: [pageViews.day, pageViews.path],
      set: { views: sql`${pageViews.views} + 1` },
    });
  return true;
}

export async function topPageViews(
  db: Db,
  days: number,
  limit = 20,
  now: Date = new Date(),
): Promise<{ path: string; views: number }[]> {
  const since = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return db
    .select({ path: pageViews.path, views: sql<number>`sum(${pageViews.views})::int` })
    .from(pageViews)
    .where(gte(pageViews.day, since))
    .groupBy(pageViews.path)
    .orderBy(sql`sum(${pageViews.views}) desc`, pageViews.path)
    .limit(limit);
}
