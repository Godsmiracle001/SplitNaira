import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Rate-limit response headers. Limits and the 429 body envelope are covered
 * in rate-limit-policies.test.ts; this file pins the headers clients use to
 * back off: the standard `RateLimit-*` set on every response and
 * `Retry-After` once the limit is hit. Legacy `X-RateLimit-*` headers are
 * deliberately not sent.
 */
const originalMax = process.env.RATE_LIMIT_MAX;

afterEach(() => {
  if (originalMax === undefined) delete process.env.RATE_LIMIT_MAX;
  else process.env.RATE_LIMIT_MAX = originalMax;
  vi.resetModules();
});

async function appWithReadLimit(limit: number) {
  process.env.RATE_LIMIT_MAX = String(limit);
  vi.resetModules();
  const { readLimiter } = await import("../rate-limit.js");
  const app = express();
  app.get("/read", readLimiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe("rate limit headers", () => {
  it("sends standard RateLimit headers, not legacy X-RateLimit ones", async () => {
    const app = await appWithReadLimit(3);
    const res = await request(app).get("/read").expect(200);

    expect(res.headers["ratelimit-limit"]).toBe("3");
    expect(res.headers["ratelimit-remaining"]).toBe("2");
    expect(res.headers).toHaveProperty("ratelimit-reset");
    expect(res.headers).not.toHaveProperty("x-ratelimit-limit");
  });

  it("decrements the remaining count down to zero", async () => {
    const app = await appWithReadLimit(3);
    const remaining: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/read").expect(200);
      remaining.push(res.headers["ratelimit-remaining"]);
    }
    expect(remaining).toEqual(["2", "1", "0"]);
  });

  it("adds Retry-After and reports it in the body once the limit is hit", async () => {
    const app = await appWithReadLimit(1);
    await request(app).get("/read").expect(200);
    const blocked = await request(app).get("/read").expect(429);

    expect(blocked.headers["ratelimit-remaining"]).toBe("0");
    const retryAfter = Number(blocked.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(Number(blocked.body.retryAfter)).toBe(retryAfter);
  });
});
