/**
 * Exact token-amount helpers. Stellar assets have 7 decimal places, so one
 * whole token is 10_000_000 stroops. Values are parsed from their string form
 * with `bigint` so that, e.g., "0.57" becomes exactly 5_700_000 stroops
 * (`Math.floor(0.57 * 1e7)` gives 5_699_999).
 *
 * Mirrors backend/src/lib/decimal-amounts.ts.
 */

export const TOKEN_DECIMALS = 7;
export const STROOPS_PER_TOKEN = 10n ** BigInt(TOKEN_DECIMALS);
export const BASIS_POINTS_TOTAL = 10_000n;

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d*))?$/;

export class AmountParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountParseError";
  }
}

/** Parses a user-entered token amount (e.g. "12.5") into stroops. */
export function parseTokenAmount(raw: string): bigint {
  const value = raw.trim();
  if (!value) throw new AmountParseError("Enter an amount.");
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) throw new AmountParseError("Enter a plain decimal number, e.g. 12.5.");
  const [, whole, fraction = ""] = match;
  if (fraction.length > TOKEN_DECIMALS) {
    throw new AmountParseError(`Use at most ${TOKEN_DECIMALS} decimal places.`);
  }
  const padded = fraction.padEnd(TOKEN_DECIMALS, "0");
  return BigInt(whole) * STROOPS_PER_TOKEN + BigInt(padded);
}

/**
 * The build endpoints accept stroops as a JSON number. Refuse values that a
 * double cannot represent exactly instead of silently rounding them.
 */
export function stroopsToSafeNumber(stroops: bigint): number {
  if (stroops > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AmountParseError("Amount is too large to submit in one transaction.");
  }
  return Number(stroops);
}

/** Converts any integer-ish API value (string, number, bigint) to bigint; invalid input yields 0n. */
export function toBigIntAmount(value: string | number | bigint | null | undefined): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return Number.isSafeInteger(value) ? BigInt(value) : 0n;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  return 0n;
}

/** Formats stroops as a token amount with grouping, trimming trailing zeros. */
export function formatStroops(
  value: string | number | bigint | null | undefined,
  { maxDecimals = TOKEN_DECIMALS }: { maxDecimals?: number } = {},
): string {
  const stroops = toBigIntAmount(value);
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_TOKEN;
  const fraction = (abs % STROOPS_PER_TOKEN)
    .toString()
    .padStart(TOKEN_DECIMALS, "0")
    .slice(0, Math.max(0, Math.min(maxDecimals, TOKEN_DECIMALS)))
    .replace(/0+$/, "");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

export interface DistributionShare {
  address: string;
  alias: string;
  basisPoints: number;
  amount: bigint;
}

/**
 * Previews what `distribute` would pay out, using the contract's rules
 * (contracts/lib.rs): each collaborator gets floor(balance * bps / 10_000),
 * except the last, who receives the remainder so the full balance is paid.
 * Returns null when the contract would reject the distribution.
 */
export function previewDistribution(
  balance: bigint,
  collaborators: ReadonlyArray<{ address: string; alias: string; basisPoints: number }>,
): DistributionShare[] | null {
  if (collaborators.length === 0 || balance <= 0n) return null;
  if (balance < BigInt(collaborators.length)) return null;
  let sent = 0n;
  return collaborators.map((collab, index) => {
    const amount =
      index === collaborators.length - 1
        ? balance - sent
        : (balance * BigInt(collab.basisPoints)) / BASIS_POINTS_TOTAL;
    sent += amount;
    return { ...collab, amount };
  });
}
