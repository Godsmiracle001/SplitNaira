// Known token contracts by network
export type TokenNetwork = "testnet" | "mainnet";

export interface TokenInfo {
  id: string; // Stellar contract ID
  name: string;
  network: TokenNetwork;
  code: string;
}

/**
 * Preset tokens offered by the token picker.
 *
 * Only addresses that can be verified are listed. The native XLM entries are
 * the Stellar Asset Contract IDs derived with
 * `Asset.native().contractId(Networks.TESTNET | Networks.PUBLIC)`. The
 * previous list held USDC/EURC IDs that failed StrKey checksum validation, so
 * a user picking them could never create a working split. Add issued assets
 * only after deriving their ID from the issuer (`new Asset(code, issuer)
 * .contractId(passphrase)`) or copying it from the issuer's documentation;
 * token-constants.test.ts rejects any entry that does not checksum.
 */
export const KNOWN_TOKENS: TokenInfo[] = [
  {
    id: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    name: "Native Stellar Lumens",
    network: "testnet",
    code: "XLM",
  },
  {
    id: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    name: "Native Stellar Lumens",
    network: "mainnet",
    code: "XLM",
  },
];

export function normalizeTokenNetwork(network: string | null): TokenNetwork | null {
  if (!network) return null;
  const normalized = network.toLowerCase();
  if (normalized.includes("test")) return "testnet";
  if (normalized.includes("main") || normalized.includes("public")) return "mainnet";
  return null;
}

/**
 * Get tokens for a specific network. When the wallet network is unknown,
 * return all presets so users can still pick a known token.
 */
export function getTokensByNetwork(network: string | null): TokenInfo[] {
  const normalizedNetwork = normalizeTokenNetwork(network);
  if (!normalizedNetwork) return KNOWN_TOKENS;
  return KNOWN_TOKENS.filter((token) => token.network === normalizedNetwork);
}

/**
 * Find a token by ID.
 */
export function getTokenById(id: string): TokenInfo | undefined {
  return KNOWN_TOKENS.find((token) => token.id === id);
}

/**
 * Get display name for a token.
 */
export function getTokenDisplayName(id: string): string {
  const token = getTokenById(id);
  return token ? `${token.code} · ${token.name} (${id.slice(0, 6)}…${id.slice(-6)})` : id;
}
