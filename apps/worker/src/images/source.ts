export interface SourceImage {
  tcgplayerId: string;
  /** Full https URL of the size we display, used as-is (never cropped or altered). */
  imageUrl: string;
}

/** One of our sets; `id` is the JustTCG slug and `name` the JustTCG set name. */
export interface OurSet {
  id: string;
  name: string;
}

export type SetImages =
  | { status: "matched"; sourceSetId: string; images: SourceImage[] }
  | { status: "unmatched"; reason: string };

/** A third-party card image source for one of our games. */
export interface ImageSource {
  /** Our (JustTCG) game id. */
  gameId: string;
  /** Stored in `cards.image_source`. */
  name: string;
  /** HTTP requests made so far. */
  readonly requestCount: number;
  /** The source's images for the source set matching `set`, keyed by TCGplayer product id. */
  setImages(set: OurSet): Promise<SetImages>;
}

/** A set as listed by a source; `code` is the source's short set code (TCGdex uses its id). */
export interface SourceSet {
  id: string;
  code: string;
  name: string;
}

/** The matched source set, or why there is none. */
export type SetMatch = { set: SourceSet } | { reason: string };

/** JustTCG prefixes most set names with a code: "ME05: Pitch Black", "ME: 30th Celebration". */
const CODE_PREFIX = /^([a-z0-9.]+):\s*(.+)$/i;

/** Lowercase, with leading zeros dropped from each number: "ME05" and "me5" compare equal. */
function normalizeSetCode(code: string): string {
  return code.toLowerCase().replace(/(?<!\d)0+(?=\d)/g, "");
}

/** Lowercase letters and digits only, accents folded and "&" read as "and". */
function normalizeSetName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unique(rule: string, matches: SourceSet[]): SetMatch | undefined {
  if (matches.length === 1) return { set: matches[0]! };
  if (matches.length > 1) {
    return { reason: `${rule} matches ${matches.map((s) => s.id).join(", ")}; add an alias` };
  }
  return undefined;
}

/**
 * Finds the source set for one of our sets. Rules, in order; the first that matches wins:
 * 1. `aliases[set.id]`: a source set id picked by hand for sets whose code and name differ.
 * 2. Code: the prefix before the colon in our name equals the source code ("ME05: …" → me05).
 * 3. Name: our name without that prefix equals the source name ("ME: 30th Celebration" →
 *    "30th Celebration"), ignoring case, accents and punctuation.
 * A rule that matches several source sets is an error, never a guess; so is matching nothing.
 */
export function matchSourceSet(
  set: OurSet,
  candidates: SourceSet[],
  aliases: Readonly<Record<string, string>> = {},
): SetMatch {
  const alias = aliases[set.id];
  if (alias) {
    const target = candidates.find((candidate) => candidate.id === alias);
    return target ? { set: target } : { reason: `alias ${alias} is not a known source set` };
  }

  const [, code, rest] = CODE_PREFIX.exec(set.name) ?? [];
  if (code) {
    const byCode = unique(
      `code ${code}`,
      candidates.filter((c) => normalizeSetCode(c.code) === normalizeSetCode(code)),
    );
    if (byCode) return byCode;
  }

  const name = normalizeSetName(rest ?? set.name);
  const byName = unique(
    `name "${name}"`,
    candidates.filter((c) => normalizeSetName(c.name) === name),
  );
  return byName ?? { reason: `no set with code ${code ?? "(none)"} or name "${rest ?? set.name}"` };
}
