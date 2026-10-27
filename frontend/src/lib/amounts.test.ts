import { describe, expect, it } from "vitest";

import {
  AmountParseError,
  formatStroops,
  parseTokenAmount,
  previewDistribution,
  stroopsToSafeNumber,
  toBigIntAmount,
} from "./amounts";
import { getDepositAmountError, getRecoveryAmountError } from "@/components/split-app-legacy";

describe("parseTokenAmount", () => {
  it.each([
    ["1", 10_000_000n],
    ["0.29", 2_900_000n],
    ["0.0000001", 1n],
    ["1.1", 11_000_000n],
    ["12.", 120_000_000n],
    ["  3.5  ", 35_000_000n],
    ["9007199254.7409911", 90_071_992_547_409_911n],
  ])("parses %s exactly", (input, expected) => {
    expect(parseTokenAmount(input)).toBe(expected);
  });

  it.each([
    ["0.57", 5_699_999, 5_700_000n],
    ["2.01", 20_099_999, 20_100_000n],
    ["1.005", 10_049_999, 10_050_000n],
  ])("parses %s exactly where float conversion lost a stroop", (input, floatResult, exact) => {
    // The previous deposit path: Math.floor(parseFloat(amount) * 1e7).
    expect(Math.floor(Number.parseFloat(input) * 10_000_000)).toBe(floatResult);
    expect(parseTokenAmount(input)).toBe(exact);
  });

  it.each(["", "abc", "-1", "1e3", "1.2.3", "0x10"])("rejects %j", (input) => {
    expect(() => parseTokenAmount(input)).toThrow(AmountParseError);
  });

  it("rejects more than 7 decimal places", () => {
    expect(() => parseTokenAmount("1.12345678")).toThrow(/at most 7 decimal places/);
  });
});

describe("stroopsToSafeNumber", () => {
  it("passes through exactly representable values", () => {
    expect(stroopsToSafeNumber(2_900_000n)).toBe(2_900_000);
  });

  it("refuses values a double cannot represent exactly", () => {
    expect(() => stroopsToSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(AmountParseError);
  });
});

describe("formatStroops", () => {
  it.each([
    ["10000000", "1"],
    ["2900000", "0.29"],
    ["1", "0.0000001"],
    ["12345670000000", "1,234,567"],
    [0, "0"],
    ["not-a-number", "0"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatStroops(input)).toBe(expected);
  });

  it("formats values above Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(formatStroops("123456789012345678901")).toBe("12,345,678,901,234.5678901");
  });
});

describe("toBigIntAmount", () => {
  it("accepts integer strings, safe numbers and bigints", () => {
    expect(toBigIntAmount("42")).toBe(42n);
    expect(toBigIntAmount(42)).toBe(42n);
    expect(toBigIntAmount(42n)).toBe(42n);
  });

  it("treats unsafe or malformed values as zero rather than guessing", () => {
    expect(toBigIntAmount(1.5)).toBe(0n);
    expect(toBigIntAmount("1.5")).toBe(0n);
    expect(toBigIntAmount(null)).toBe(0n);
  });
});

describe("previewDistribution", () => {
  const collab = (address: string, basisPoints: number) => ({ address, alias: address, basisPoints });

  it("pays floor shares and gives the remainder to the last collaborator, like the contract", () => {
    const shares = previewDistribution(100n, [collab("a", 3333), collab("b", 3333), collab("c", 3334)]);
    expect(shares?.map((s) => s.amount)).toEqual([33n, 33n, 34n]);
  });

  it("always pays out the full balance", () => {
    for (const balance of [3n, 7n, 999_999_999n, 10_000_000_000_001n]) {
      const shares = previewDistribution(balance, [collab("a", 1), collab("b", 4999), collab("c", 5000)]);
      expect(shares?.reduce((sum, s) => sum + s.amount, 0n)).toBe(balance);
    }
  });

  it("returns null where the contract would reject the distribution", () => {
    expect(previewDistribution(0n, [collab("a", 5000), collab("b", 5000)])).toBeNull();
    // Balance smaller than the number of collaborators: contract returns NoBalance.
    expect(previewDistribution(1n, [collab("a", 5000), collab("b", 5000)])).toBeNull();
    expect(previewDistribution(100n, [])).toBeNull();
  });
});

describe("deposit and recovery amount validation", () => {
  it.each([
    ["", "Enter an amount to deposit."],
    ["0", "Enter an amount greater than 0."],
    ["-5", "Enter an amount greater than 0."],
    ["1.12345678", "Use at most 7 decimal places."],
    ["0.29", null],
  ])("deposit %j -> %s", (input, expected) => {
    expect(getDepositAmountError(input)).toBe(expected);
  });

  it.each([
    ["", "1000", "Enter a whole number of stroops."],
    ["1.5", "1000", "Enter a whole number of stroops."],
    ["0", "1000", "Enter an amount greater than 0."],
    ["1001", "1000", "Amount exceeds the unallocated balance."],
    ["1000", "1000", null],
  ])("recovery %j of %s -> %s", (input, available, expected) => {
    expect(getRecoveryAmountError(input, available)).toBe(expected);
  });
});
