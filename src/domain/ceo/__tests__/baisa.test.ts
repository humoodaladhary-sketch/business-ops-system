// Money is integer baisa. These tests exist because a float that is 0.1 baisa
// wrong per deal is a book that is wrong by a number nobody can explain.
import { describe, expect, it } from "vitest";

import { MoneyParseError, applyPct, formatOmr, omrStringToBaisa, ratio } from "../baisa";

describe("parsing OMR to baisa", () => {
  it.each([
    ["139131.719", 139_131_719],
    ["2000", 2_000_000],
    ["550.5", 550_500],
    ["0", 0],
    ["", 0],
    ["-12.5", -12_500],
    [" 1,234.560 ", 1_234_560],
  ])("parses %s to %d baisa", (input, expected) => {
    expect(omrStringToBaisa(input)).toBe(expected);
  });

  it("avoids the float error that is already visible in the source sheet", () => {
    // Deal SHA-0002: a 35% cut of 4,869.610. The exact decimal answer is
    // 1,704.3635, which rounds half-up to 1,704.364. In binary floating point
    // the same product is 1704.3634999999997, which rounds DOWN to 1,704.363 —
    // and 1,704.363 is precisely what the source sheet recorded. That one baisa,
    // repeated, is where the sheet's net column drifts from its own components.
    expect(4869.61 * (35 / 100)).toBe(1704.3634999999997);
    expect((4869.61 * (35 / 100)).toFixed(3)).toBe("1704.363");

    // Integer baisa gets it right, and gets it right every time.
    expect(applyPct(omrStringToBaisa("4869.610"), 35)).toBe(1_704_364);
  });

  it("refuses to silently truncate a fourth decimal", () => {
    expect(() => omrStringToBaisa("1.2345")).toThrow(MoneyParseError);
  });

  it("rejects anything that is not a decimal amount", () => {
    expect(() => omrStringToBaisa("abc")).toThrow(MoneyParseError);
    expect(() => omrStringToBaisa("1.2.3")).toThrow(MoneyParseError);
  });
});

describe("percentages", () => {
  it("applies a commission percentage half-up to the baisa", () => {
    // 4,869.610 x 35% = 1,704.3635 → 1,704.364 half-up.
    expect(applyPct(4_869_610, 35)).toBe(1_704_364);
  });

  it("rounds negatives symmetrically", () => {
    expect(applyPct(-4_869_610, 35)).toBe(-1_704_364);
  });
});

describe("ratios", () => {
  it("returns null rather than Infinity or a misleading zero", () => {
    expect(ratio(5_000, 0)).toBeNull();
    expect(ratio(0, 1_000)).toBe(0);
  });
});

describe("formatting", () => {
  it("keeps three decimals and Western digits", () => {
    expect(formatOmr(3_091_225_563)).toBe("3,091,225.563");
    expect(formatOmr(550_500, { decimals: 2 })).toBe("550.50");
  });

  it("rounds rather than truncates when asked for fewer decimals", () => {
    expect(formatOmr(1_999, { decimals: 0 })).toBe("2");
    expect(formatOmr(1_500, { decimals: 0 })).toBe("2");
    expect(formatOmr(1_499, { decimals: 0 })).toBe("1");
  });

  it("does not render a negative zero", () => {
    expect(formatOmr(-100, { decimals: 0 })).toBe("0");
  });
});
