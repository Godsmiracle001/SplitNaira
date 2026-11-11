import express from "express";
import request from "supertest";
import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  collaborationRouter,
  setProjectDeletionSnapshotResolver,
  setProjectRoleContextResolver,
} from "./collaboration.js";
import { errorHandler, notFoundHandler } from "../middleware/error.js";
import { requestIdMiddleware } from "../middleware/request-id.js";
import {
  getProjectDeletionAuditLog,
  resetProjectDeletionAuditForTests,
} from "../services/collaboration/project-deletion.js";
import {
  registerInvitation,
  resetInvitationRegistryForTests,
} from "../services/collaboration/invitation-registry.js";
import { resetOwnershipTransferForTests } from "../services/splits/ownership-transfer.js";
import { sessionHeader } from "../test/auth-helpers.js";

// The contract call builder needs RPC; stop at the boundary.
vi.mock("../services/splits.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/splits.service.js")>()),
  buildUnsignedContractCall: vi.fn(async (input: { sourceAddress: string; operation: string }) => ({
    xdr: "XDR_TRANSFER",
    metadata: { operation: input.operation, sourceAccount: input.sourceAddress },
  })),
}));

// No database here: treat every wallet as having no stored session version.
vi.mock("../services/session-revocation.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/session-revocation.js")>()),
  getSessionVersion: vi.fn().mockResolvedValue(null),
}));

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use("/collaboration", collaborationRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

describe("collaboration workflow routes", () => {
  let owner: string;
  let admin: string;
  let stranger: string;
  let newOwner: string;

  beforeEach(() => {
    owner = Keypair.random().publicKey();
    admin = Keypair.random().publicKey();
    stranger = Keypair.random().publicKey();
    newOwner = Keypair.random().publicKey();
    resetInvitationRegistryForTests();
    resetOwnershipTransferForTests();
    resetProjectDeletionAuditForTests();
    setProjectRoleContextResolver(async () => ({
      owner,
      collaborators: [{ address: admin, role: "admin" }],
    }));
    setProjectDeletionSnapshotResolver(async (projectId) => ({
      projectId,
      hasDeposits: true,
      hasDistributions: false,
      hasClaims: false,
      transactionCount: 1,
    }));
  });

  it("requires the authenticated current owner and ignores client-supplied owner claims", async () => {
    const response = await request(createApp())
      .post("/collaboration/projects/project_1/transfer-ownership")
      .set("Authorization", sessionHeader(stranger))
      .send({ actor: owner, currentOwner: stranger, newOwner })
      .expect(403);

    expect(response.body.error).toBe("forbidden_not_owner");
  });

  it("transfers ownership for the authenticated current owner", async () => {
    const response = await request(createApp())
      .post("/collaboration/projects/project_1/transfer-ownership")
      .set("Authorization", sessionHeader(owner))
      .send({ actor: stranger, currentOwner: stranger, newOwner })
      .expect(200);

    expect(response.body.transfer).toMatchObject({
      fromOwner: owner,
      toOwner: newOwner,
      authorizedBy: owner,
    });
    // The owner still has to sign this; ownership changes on-chain.
    expect(response.body.metadata.operation).toBe("transfer_project_ownership");
  });

  it("records the authenticated inviter and blocks unauthenticated invitations", async () => {
    await request(createApp())
      .post("/collaboration/projects/project_1/invitations")
      .send({ email: "person@example.com", tokenJti: "no-auth" })
      .expect(401);

    const response = await request(createApp())
      .post("/collaboration/projects/project_1/invitations")
      .set("Authorization", sessionHeader(admin))
      .send({
        email: "person@example.com",
        tokenJti: "invite-authenticated-admin",
        inviterWalletAddress: stranger,
      })
      .expect(201);

    expect(response.body.invitation.inviterWalletAddress).toBe(admin);
  });

  it("rejects expired invitation tokens at the API boundary", async () => {
    registerInvitation({
      email: "expired@example.com",
      tokenJti: "expired-token",
      projectId: "project_1",
      inviterWalletAddress: admin,
      ttlMs: 1,
      now: new Date("2020-01-01T00:00:00.000Z"),
    });

    const response = await request(createApp())
      .post("/collaboration/invitations/accept")
      .send({ tokenJti: "expired-token" })
      .expect(410);

    expect(response.body.error).toBe("invitation_expired");
  });

  it("uses server financial history and authenticated identity for deletion", async () => {
    const response = await request(createApp())
      .post("/collaboration/projects/project_1/delete")
      .set("Authorization", sessionHeader(owner))
      .send({
        actor: stranger,
        confirmed: true,
        confirmationText: "DELETE PROJECT",
        financial: {
          projectId: "project_1",
          hasDeposits: false,
          hasDistributions: false,
          hasClaims: false,
          transactionCount: 0,
        },
      })
      .expect(200);

    expect(response.body.decision.mode).toBe("soft");
    expect(getProjectDeletionAuditLog()[0].actor).toBe(owner);
    expect(getProjectDeletionAuditLog()[0].financial.hasDeposits).toBe(true);
  });
});