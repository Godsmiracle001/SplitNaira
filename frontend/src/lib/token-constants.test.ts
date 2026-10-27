import { Asset, Networks, StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { KNOWN_TOKENS, getTokensByNetwork } from "./token-constants";

describe("token constants", () => {
  it("only lists contract IDs that pass StrKey checksum validation", () => {
    for (const token of KNOWN_TOKENS) {
      expect(StrKey.isValidContract(token.id), `${token.code} on ${token.network}`).toBe(true);
    }
  });

  it("lists the derived native asset contract for each network", () => {
    const xlm = (network: "testnet" | "mainnet") =>
      getTokensByNetwork(network).find((token) => token.code === "XLM")?.id;
    expect(xlm("testnet")).toBe(Asset.native().contractId(Networks.TESTNET));
    expect(xlm("mainnet")).toBe(Asset.native().contractId(Networks.PUBLIC));
  });

  it("does not expose unsupported native token options", () => {
    expect(KNOWN_TOKENS.some((token) => token.id === "native")).toBe(false);
  });

  it("only returns contract-address tokens for each network", () => {
    for (const network of ["testnet", "mainnet"] as const) {
      const networkTokens = getTokensByNetwork(network);
      expect(networkTokens.length).toBeGreaterThan(0);
      for (const token of networkTokens) {
        expect(token.id.startsWith("C")).toBe(true);
      }
    }
  });
});
