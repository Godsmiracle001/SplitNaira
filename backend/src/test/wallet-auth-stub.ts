/**
 * For suites about something other than signature checking (registration
 * persistence, lockout, uniqueness, enumeration) that use fixed addresses
 * whose keys they do not hold. The stub accepts exactly TEST_SIGNED_CHALLENGE
 * and rejects anything else, so "no or bad signature" paths still fail.
 * Real verification is covered by wallet-auth.test.ts and users-wallet-auth.test.ts.
 *
 *   vi.mock("../services/wallet-auth.js", async (importOriginal) =>
 *     (await import("../test/wallet-auth-stub.js")).stubWalletAuth(await importOriginal()));
 */
export const TEST_SIGNED_CHALLENGE = "test-signed-challenge";

interface WalletAuthModule {
  WalletAuthError: new (message: string) => Error;
  verifySignedChallenge: (signedChallenge: string, account: string, now?: number) => void;
}

export function stubWalletAuth<T extends WalletAuthModule>(actual: T): T {
  return {
    ...actual,
    verifySignedChallenge: (signedChallenge: string) => {
      if (signedChallenge !== TEST_SIGNED_CHALLENGE) {
        throw new actual.WalletAuthError("Challenge is invalid or expired.");
      }
    },
  };
}
