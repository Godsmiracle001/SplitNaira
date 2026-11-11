import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHALLENGE_TIMEOUT_SECONDS,
  WalletAuthError,
  issueChallenge,
  resetWalletAuthForTests,
  verifySignedChallenge,
} from "../services/wallet-auth.js";
import { signedChallengeFor } from "../test/auth-helpers.js";

beforeEach(() => resetWalletAuthForTests());

describe("wallet sign-in challenge", () => {
  it("accepts a challenge signed by the account it was issued for", () => {
    const wallet = Keypair.random();
    expect(() => verifySignedChallenge(signedChallengeFor(wallet), wallet.publicKey())).not.toThrow();
  });

  it("rejects an unsigned challenge", () => {
    const wallet = Keypair.random();
    const { challenge } = issueChallenge(wallet.publicKey());
    expect(() => verifySignedChallenge(challenge, wallet.publicKey())).toThrow(WalletAuthError);
  });

  it("rejects a challenge signed by a different key", () => {
    const wallet = Keypair.random();
    const { challenge, networkPassphrase } = issueChallenge(wallet.publicKey());
    const tx = TransactionBuilder.fromXDR(challenge, networkPassphrase);
    tx.sign(Keypair.random());
    expect(() => verifySignedChallenge(tx.toXDR(), wallet.publicKey())).toThrow(/not signed by the account/);
  });

  it("rejects a challenge presented for a different account", () => {
    const wallet = Keypair.random();
    const victim = Keypair.random().publicKey();
    expect(() => verifySignedChallenge(signedChallengeFor(wallet), victim)).toThrow(/different account/);
  });

  it("accepts each signed challenge only once", () => {
    const wallet = Keypair.random();
    const signed = signedChallengeFor(wallet);
    verifySignedChallenge(signed, wallet.publicKey());
    expect(() => verifySignedChallenge(signed, wallet.publicKey())).toThrow(/already been used/);
  });

  it("rejects an expired challenge", () => {
    const wallet = Keypair.random();
    const { challenge, networkPassphrase, expiresAt } = issueChallenge(wallet.publicKey());
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(CHALLENGE_TIMEOUT_SECONDS * 1000);
    const tx = TransactionBuilder.fromXDR(challenge, networkPassphrase);
    tx.sign(wallet);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (CHALLENGE_TIMEOUT_SECONDS + 60) * 1000);
    try {
      expect(() => verifySignedChallenge(tx.toXDR(), wallet.publicKey())).toThrow(/invalid or expired/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a challenge the server did not issue", () => {
    const wallet = Keypair.random();
    const forged = signedChallengeFor(wallet);
    resetWalletAuthForTests(); // new server key: the old challenge no longer verifies
    expect(() => verifySignedChallenge(forged, wallet.publicKey())).toThrow(/invalid or expired/);
  });

  it("rejects garbage", () => {
    expect(() => verifySignedChallenge("not-xdr", Keypair.random().publicKey())).toThrow(WalletAuthError);
  });
});
