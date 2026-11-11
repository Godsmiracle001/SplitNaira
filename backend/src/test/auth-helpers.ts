import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

import { signToken } from "../services/jwt.js";
import { issueChallenge } from "../services/wallet-auth.js";

/** `Authorization` header value for a wallet session, as issued after sign-in. */
export function sessionHeader(walletAddress: string, sessionVersion = 0): string {
  return `Bearer ${signToken(walletAddress, sessionVersion)}`;
}

/** A challenge from GET /auth/challenge, signed by `keypair` the way its wallet would. */
export function signedChallengeFor(keypair: Keypair): string {
  const { challenge, networkPassphrase } = issueChallenge(keypair.publicKey());
  const tx = TransactionBuilder.fromXDR(challenge, networkPassphrase);
  tx.sign(keypair);
  return tx.toXDR();
}
