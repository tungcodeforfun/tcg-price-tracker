const MAX_CENTS = 100_000_000;

export type ParsedDollars = { ok: true; cents: number | null } | { ok: false; message: string };

/** Parses a user-typed dollar amount ("12.5", "$1,200.00") into integer cents; blank means unknown (null). */
export function parseDollars(input: string): ParsedDollars {
  const text = input.trim().replace(/^\$/, "").replaceAll(",", "");
  if (text === "") return { ok: true, cents: null };
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false, message: "Enter an amount like 12.50" };
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents > MAX_CENTS) return { ok: false, message: "Amount is too large" };
  return { ok: true, cents };
}

/** Cents as a plain decimal string ("12.50"), for form defaults and CSV. */
export function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
