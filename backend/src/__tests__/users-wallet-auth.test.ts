import express from "express";
import request from "supertest";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOne } = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../services/database.js", () => ({
  getDataSource: () => ({ getRepository: () => ({ findOne, exists: vi.fn().mockResolvedValue(false) }) }),
  withTransaction: vi.fn(),
}));

import { errorHandler } from "../middleware/error.js";
import { requestIdMiddleware } from "../middleware/request-id.js";
import { authAccountRouter } from "../routes/auth-account.js";
import { usersRouter } from "../routes/users.js";
import { resetWalletAuthForTests } from "../services/wallet-auth.js";
import { verifyToken } from "../services/jwt.js";

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use("/auth", authAccountRouter);
app.use("/users", usersRouter);
app.use(errorHandler);

const userFor = (wallet: string) => ({
  id: "user-1",
  walletAddress: wallet,
  isActive: true,
  sessionVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** What the frontend does: fetch a challenge, have the wallet sign it. */
async function signInBody(wallet: Keypair, signer: Keypair = wallet) {
  const { body } = await request(app).get("/auth/challenge").query({ account: wallet.publicKey() }).expect(200);
  const tx = TransactionBuilder.fromXDR(body.challenge, body.networkPassphrase);
  tx.sign(signer);
  return { walletAddress: wallet.publicKey(), signedChallenge: tx.toXDR() };
}

beforeEach(() => {
  resetWalletAuthForTests();
  findOne.mockReset();
});

describe("wallet sign-in over HTTP", () => {
  it("issues a session for a challenge signed by the wallet", async () => {
    const wallet = Keypair.random();
    findOne.mockResolvedValue(userFor(wallet.publicKey()));

    const res = await request(app).post("/users/login").send(await signInBody(wallet)).expect(200);

    expect(verifyToken(res.body.token)?.walletAddress).toBe(wallet.publicKey());
  });

  it("refuses a registered wallet address without its signature (the old takeover)", async () => {
    const victim = Keypair.random();
    findOne.mockResolvedValue(userFor(victim.publicKey()));

    const res = await request(app)
      .post("/users/login")
      .send(await signInBody(victim, Keypair.random()))
      .expect(401);

    expect(res.body.token).toBeUndefined();
  });

  it("requires a signed challenge at all", async () => {
    await request(app).post("/users/login").send({ walletAddress: Keypair.random().publicKey() }).expect(400);
  });

  it("does not accept the same signed challenge twice", async () => {
    const wallet = Keypair.random();
    findOne.mockResolvedValue(userFor(wallet.publicKey()));
    const body = await signInBody(wallet);

    await request(app).post("/users/login").send(body).expect(200);
    await request(app).post("/users/login").send(body).expect(401);
  });

  it("refuses to register an address the caller cannot sign for", async () => {
    const victim = Keypair.random();
    const res = await request(app)
      .post("/users/register")
      .send({ ...(await signInBody(victim, Keypair.random())), email: "x@example.com" });

    expect(res.status).toBe(401);
  });

  it("rejects a malformed account when issuing a challenge", async () => {
    await request(app).get("/auth/challenge").query({ account: "not-an-address" }).expect(400);
  });
});
