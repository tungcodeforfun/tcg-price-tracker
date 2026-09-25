/** The price feed fills unknown fields with "None" / "N/A"; treat those as missing. */
export function known(value: string | null | undefined): string | null {
  return value && !/^(none|n\/a)$/i.test(value.trim()) ? value : null;
}

/** Exchange-style set code: "McDonald's Promos 2014" → "MP14", "Set Sail Deck Set" → "SSDS". */
export function setCode(setName: string): string {
  const words = setName
    .replace(/['’]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const year = words.find((w) => /^(19|20)\d\d$/.test(w));
  const letters = words
    .filter((w) => !/^\d+$/.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const code = year ? `${letters.slice(0, 2)}${year.slice(2)}` : letters.slice(0, 4);
  return code || "SET";
}

/** "005/012" → "005"; placeholders like "N/A" have no number. */
function shortNumber(number: string | null): string | null {
  const head = known(number)?.split("/")[0]?.trim();
  return head && /\d/.test(head) ? head : null;
}

/** Ticker symbol for a card: set code plus card number ("MP14.5"), or the set code alone. */
export function symbolFor(card: { setName: string; number: string | null }): string {
  const num = shortNumber(card.number);
  return num ? `${setCode(card.setName)}.${num}` : setCode(card.setName);
}

/** "Pikachu - 5/12" → "Pikachu"; the number already lives in the symbol. */
export function shortName(name: string): string {
  return name.replace(/\s+-\s+\d+\/\d+$/, "");
}
