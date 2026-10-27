import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import winston from "winston";
import { logger } from "../services/logger.js";

const sensitiveFields = [
  {
    operation: "authentication",
    fields: [
      "password",
      "accessToken",
      "refresh_token",
      "authorization",
      "cookie",
      "api_key",
      "sessionId",
    ],
  },
  {
    operation: "payments",
    fields: [
      "cardNumber",
      "cvv",
      "cvc",
      "security_code",
      "accountNumber",
      "routing_number",
      "iban",
      "paymentToken",
    ],
  },
  {
    operation: "wallet",
    fields: ["walletAddress", "privateKey", "secret_key", "mnemonic", "seed"],
  },
] as const;

describe("Winston logger — structured sensitive-field redaction", () => {
  // Capture the fully formatted output through a dedicated transport. The
  // Console transport binds console.log when it is constructed, so spying on
  // console.log from a test never observes it.
  let lines: string[];
  let capture: winston.transport;

  beforeEach(() => {
    lines = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    capture = new winston.transports.Stream({ stream });
    logger.add(capture);
  });

  afterEach(() => {
    logger.remove(capture);
  });

  for (const { operation, fields } of sensitiveFields) {
    describe(`${operation} operations`, () => {
      it.each(fields)("redacts $0 from nested structured metadata", (field) => {
        const sensitiveValue = `sensitive-${operation}-${field}`;
        logger.info(`${operation} operation`, {
          details: [{ [field]: sensitiveValue }],
          outcome: "accepted",
        });

        expect(lines).toHaveLength(1);
        const output = lines[0];
        expect(output).not.toContain(sensitiveValue);
        expect(output).toContain("[REDACTED]");
        expect(output).toContain("accepted");
      });
    });
  }

  it("preserves non-sensitive metadata alongside redacted walletAddress", () => {
    logger.info("Transaction recorded", {
      walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      txHash: "abc123",
      amount: "100.00",
    });

    const output = lines[0];
    expect(output).toContain("txHash");
    expect(output).toContain("abc123");
    expect(output).toContain("amount");
    expect(output).toContain("100.00");
  });

  it("redacts sensitive keys regardless of casing or separators", () => {
    logger.info("User login", {
      Access_Token: "mixed-case-access-token",
      requestId: "test-request",
    });

    const output = lines[0];
    expect(output).not.toContain("mixed-case-access-token");
    expect(output).toContain("[REDACTED]");
  });
});
