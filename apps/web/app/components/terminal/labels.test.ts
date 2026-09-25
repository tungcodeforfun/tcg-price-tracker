import { describe, expect, it } from "vitest";
import { known, setCode, shortName, symbolFor } from "./labels";

describe("known", () => {
  it.each(["N/A", "n/a", "None", " none "])(
    "treats the feed placeholder %j as missing",
    (value) => {
      expect(known(value)).toBeNull();
    },
  );

  it("keeps real values", () => {
    expect(known("Common")).toBe("Common");
    expect(known("Nonexistent")).toBe("Nonexistent");
  });
});

describe("setCode", () => {
  it("abbreviates the words and keeps a two-digit year", () => {
    expect(setCode("McDonald's Promos 2014")).toBe("MP14");
  });

  it("caps codes without a year at four letters", () => {
    expect(setCode("Set Sail Deck Set Display")).toBe("SSDS");
  });

  it("never returns an empty code", () => {
    expect(setCode("★ ★")).toBe("SET");
  });
});

describe("symbolFor", () => {
  it("joins the set code and the card number", () => {
    expect(symbolFor({ setName: "McDonald's Promos 2014", number: "5/12" })).toBe("MP14.5");
  });

  it.each([null, "N/A", "None"])("omits the number when it is %j", (number) => {
    expect(symbolFor({ setName: "Set Sail Deck Set", number })).toBe("SSDS");
  });
});

describe("shortName", () => {
  it("drops the trailing number the symbol already carries", () => {
    expect(shortName("Pikachu - 5/12")).toBe("Pikachu");
    expect(shortName("Monkey.D.Luffy")).toBe("Monkey.D.Luffy");
  });
});
