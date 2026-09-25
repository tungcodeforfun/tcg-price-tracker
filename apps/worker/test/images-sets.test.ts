import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchSourceSet, type SetMatch, type SourceSet } from "../src/images/source.ts";

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/images/${name}`, import.meta.url), "utf8"));

const tcgdexSets: SourceSet[] = fixture<{ id: string; name: string }[]>("tcgdex-sets.json").map(
  (s) => ({ id: s.id, code: s.id, name: s.name }),
);
const lorcastSets = fixture<{ results: SourceSet[] }>("lorcast-sets.json").results;

const matchedId = (result: SetMatch) => ("set" in result ? result.set.id : null);

describe("matchSourceSet", () => {
  it("matches the code before the colon, ignoring case and leading zeros", () => {
    const set = { id: "me05-pitch-black-pokemon", name: "ME05: Pitch Black" };
    expect(matchedId(matchSourceSet(set, tcgdexSets))).toBe("me05");
    const zeroless = [{ id: "me5", code: "me5", name: "Something else" }];
    expect(matchedId(matchSourceSet(set, zeroless))).toBe("me5");
  });

  it("falls back to the name after the code, exactly, not to similar names", () => {
    const set = { id: "me-30th-celebration-pokemon", name: "ME: 30th Celebration" };
    expect(matchedId(matchSourceSet(set, tcgdexSets))).toBe("30th");
  });

  it("compares names ignoring case, accents and punctuation", () => {
    const set = { id: "attack-of-the-vine-disney-lorcana", name: "attack of the vine" };
    expect(matchedId(matchSourceSet(set, lorcastSets))).toBe(
      "set_57c6817823c14dda8eccbca4b555d858",
    );
    const accented = [{ id: "x", code: "x", name: "Pokémon Café & Friends" }];
    expect(matchedId(matchSourceSet({ id: "y", name: "Pokemon Cafe and Friends" }, accented))).toBe(
      "x",
    );
  });

  it("leaves a set whose name differs unmatched, with the reason, unless it has an alias", () => {
    const classic = {
      id: "me-30th-celebration-classic-collection-pokemon",
      name: "ME: 30th Celebration Classic Collection",
    };
    expect(matchSourceSet(classic, tcgdexSets)).toEqual({
      reason: 'no set with code ME or name "30th Celebration Classic Collection"',
    });
    const aliases = { [classic.id]: "30th-c" };
    expect(matchedId(matchSourceSet(classic, tcgdexSets, aliases))).toBe("30th-c");
    expect(matchSourceSet(classic, tcgdexSets, { [classic.id]: "gone" })).toEqual({
      reason: "alias gone is not a known source set",
    });
  });

  it("refuses to pick between several sets a rule matches", () => {
    const twins = [
      { id: "a", code: "a", name: "Base Set" },
      { id: "b", code: "b", name: "Base Set" },
    ];
    expect(matchSourceSet({ id: "base-set-pokemon", name: "Base Set" }, twins)).toEqual({
      reason: 'name "base set" matches a, b; add an alias',
    });
  });
});
