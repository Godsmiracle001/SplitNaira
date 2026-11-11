/**
 * Wallet sign-in by SEP-10 challenge.
 *
 * Proves the caller controls a Stellar account before a session is issued.
 * The server builds a challenge transaction (signed by the server key, time
 * bounded, never submittable: sequence 0 and a random nonce); the wallet
 * signs it with `signTransaction`, which every Stellar wallet supports; the
 * server checks its own signature, the time bounds and the client's
 * signature, then accepts each challenge once.
 *
 * Verification checks the account's master key. Accounts that have disabled
 * the master key in favour of other signers are not supported yet.
 */
import { Keypair, WebAuth, type Transaction } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";

import { logger } from "./logger.js";

export const CHALLENGE_TIMEOUT_SECONDS = 300;
const DEFAULT_HOME_DOMAIN = "splitnaira.app";

let serverKeypair: Keypair | null = null;

/**
 * The key that signs challenges. Required in production (config/env.ts);
 * elsewhere a random key is generated per process, which is fine because a
 * challenge only has to verify on the process that issued it.
 */
function getServerKeypair(): Keypair {
  if (serverKeypair) return serverKeypair;
  const secret = process.env.AUTH_CHALLENGE_SIGNING_SECRET?.trim();
  if (secret) {
    serverKeypair = Keypair.fromSecret(secret);
  } else {
    serverKeypair = Keypair.random();
    logger.warn(
      "AUTH_CHALLENGE_SIGNING_SECRET is not set; using a per-process key. Wallet sign-in will not work across restarts or instances."
    );
  }
  return serverKeypair;
}

function getHomeDomain(): string {
  return process.env.AUTH_HOME_DOMAIN?.trim() || DEFAULT_HOME_DOMAIN;
}

function getNetworkPassphrase(): string {
  const passphrase = process.env.SOROBAN_NETWORK_PASSPHRASE;
  if (!passphrase) throw new Error("SOROBAN_NETWORK_PASSPHRASE is not configured");
  return passphrase;
}

export interface IssuedChallenge {
  /** Base64 XDR of the challenge transaction for the wallet to sign. */
  challenge: string;
  networkPassphrase: string;
  /** Epoch milliseconds after which the challenge is rejected. */
  expiresAt: number;
}

export function issueChallenge(account: string, now = Date.now()): IssuedChallenge {
  const homeDomain = getHomeDomain();
  const networkPassphrase = getNetworkPassphrase();
  const challenge = WebAuth.buildChallengeTx(
    getServerKeypair(),
    account,
    homeDomain,
    CHALLENGE_TIMEOUT_SECONDS,
    networkPassphrase,
    homeDomain
  );
  return { challenge, networkPassphrase, expiresAt: now + CHALLENGE_TIMEOUT_SECONDS * 1000 };
}

/** Challenge hash -> expiry (ms). Each signed challenge is accepted once. */
const usedChallenges = new Map<string, number>();

function pruneUsed(now: number): void {
  for (const [hash, expiresAt] of usedChallenges) {
    if (expiresAt <= now) usedChallenges.delete(hash);
  }
}

export class WalletAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAuthError";
  }
}

/**
 * Verifies a challenge signed by `account`. Throws WalletAuthError for any
 * failure: wrong or expired challenge, missing signature, or replay.
 */
export function verifySignedChallenge(signedChallenge: string, account: string, now = Date.now()): void {
  const homeDomain = getHomeDomain();
  const server = getServerKeypair();
  let tx: Transaction;
  try {
    const read = WebAuth.readChallengeTx(
      signedChallenge,
      server.publicKey(),
      getNetworkPassphrase(),
      homeDomain,
      homeDomain
    );
    if (read.clientAccountID !== account) {
      throw new WalletAuthError("Challenge was issued for a different account.");
    }
    tx = read.tx;
  } catch (error) {
    if (error instanceof WalletAuthError) throw error;
    // Covers bad XDR, wrong server signature, expired time bounds.
    throw new WalletAuthError("Challenge is invalid or expired.");
  }

  const maxTime = Number(tx.timeBounds?.maxTime ?? 0) * 1000;
  if (!maxTime || maxTime <= now) {
    throw new WalletAuthError("Challenge is invalid or expired.");
  }

  if (!WebAuth.verifyTxSignedBy(tx, account)) {
    throw new WalletAuthError("Challenge is not signed by the account.");
  }

  pruneUsed(now);
  const hash = createHash("sha256").update(tx.hash()).digest("hex");
  if (usedChallenges.has(hash)) {
    throw new WalletAuthError("Challenge has already been used.");
  }
  usedChallenges.set(hash, maxTime);
}

export function resetWalletAuthForTests(): void {
  serverKeypair = null;
  usedChallenges.clear();
}
