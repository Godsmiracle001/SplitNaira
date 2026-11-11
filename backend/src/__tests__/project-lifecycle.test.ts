import express from "express";
import request from "supertest";
import { Keypair } from "@stellar/stellar-sdk";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cancel / archive / restore routes and the guards on funding, distribution
 * and collaborator edits. Needs a migrated Postgres (DATABASE_URL); skips
 * locally when none is reachable, fails in CI so it cannot pass by skipping.
 */

const OWNER = Keypair.random().publicKey();
const { onChain } = vi.hoisted(() => ({
  onChain: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../services/splits.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/splits.service.js")>();
  const { AppError, ErrorCode, ErrorType } = await import("../lib/errors.js");
  return {
    ...actual,
    fetchProjectById: vi.fn(async (id: string) => onChain.get(id) ?? null),
    assertProjectOwner: vi.fn(async (id: string, owner: string) => {
      const project = onChain.get(id);
      if (!project) throw new AppError(ErrorType.CONTRACT, ErrorCode.NOT_FOUND, "not found");
      if (project.owner !== owner) {
        throw new AppError(ErrorType.AUTH, ErrorCode.UNAUTHORIZED, "Caller is not the project owner");
      }
    }),
  };
});
vi.mock("../services/session-revocation.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/session-revocation.js")>()),
  getSessionVersion: vi.fn().mockResolvedValue(null),
}));

import { splitsRouter } from "../routes/splits.js";
import { errorHandler } from "../middleware/error.js";
import { requestIdMiddleware } from "../middleware/request-id.js";
import { DataSource } from "typeorm";
import { ENTITIES, setDataSourceForTests } from "../services/database.js";
import { assertProjectActionAllowed } from "../services/project-lifecycle.js";
import { sessionHeader } from "../test/auth-helpers.js";

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use("/splits", splitsRouter);
app.use(errorHandler);

const RUN = `lc${Date.now().toString(36)}`;
let dbReady = false;
let counter = 0;

function newProject(overrides: Record<string, unknown> = {}): string {
  counter += 1;
  const id = `${RUN}_${counter}`;
  onChain.set(id, {
    owner: OWNER,
    locked: false,
    balance: "0",
    total_distributed: "0",
    distribution_round: 0,
    collaborators: [],
    ...overrides,
  });
  return id;
}

const asOwner = (req: request.Test) => req.set("Authorization", sessionHeader(OWNER));

let ds: DataSource | null = null;

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    if (process.env.CI) throw new Error("DATABASE_URL is required in CI");
    return;
  }
  // The app's initDatabase() also loads the migration files, which the test
  // runner cannot import; the schema is already migrated.
  const candidate = new DataSource({ type: "postgres", url, entities: ENTITIES });
  try {
    await candidate.initialize();
  } catch (error) {
    if (process.env.CI) throw error;
    return;
  }
  ds = candidate;
  setDataSourceForTests(ds);
  dbReady = true;
});

afterAll(async () => {
  if (!ds) return;
  await ds.query(`DELETE FROM "split_cancellations" WHERE "projectId" LIKE $1`, [`${RUN}%`]);
  await ds.query(`DELETE FROM "project_archivals" WHERE "projectId" LIKE $1`, [`${RUN}%`]);
  setDataSourceForTests(null);
  await ds.destroy();
});

beforeEach(({ skip }) => {
  if (!dbReady) skip();
});

describe("project cancellation", () => {
  it("requires a signed-in session", async () => {
    await request(app).post(`/splits/${newProject()}/cancel`).send({}).expect(401);
  });

  it("refuses anyone but the on-chain owner", async () => {
    const id = newProject();
    await request(app)
      .post(`/splits/${id}/cancel`)
      .set("Authorization", sessionHeader(Keypair.random().publicKey()))
      .send({})
      .expect(401);
  });

  it("cancels, then blocks new funding and a second cancellation", async () => {
    const id = newProject();
    const res = await asOwner(request(app).post(`/splits/${id}/cancel`)).send({ reason: "changed plans" }).expect(200);
    expect(res.body.cancellation).toMatchObject({ projectId: id, cancelledBy: OWNER, reason: "changed plans" });

    const lifecycle = await request(app).get(`/splits/${id}/lifecycle`).expect(200);
    expect(lifecycle.body).toMatchObject({ cancelled: true, archived: false });

    await expect(assertProjectActionAllowed(id, "fund")).rejects.toMatchObject({ code: "SPLIT_CANCELLED" });
    const again = await asOwner(request(app).post(`/splits/${id}/cancel`)).send({}).expect(409);
    expect(again.body.code).toBe("SPLIT_CANCELLED");
  });

  it("refuses to cancel a split that has started distributing", async () => {
    const id = newProject({ total_distributed: "500", distribution_round: 1 });
    const res = await asOwner(request(app).post(`/splits/${id}/cancel`)).send({}).expect(409);
    expect(res.body.code).toBe("NOT_CANCELLABLE");
  });
});

describe("project archival", () => {
  it("archives, blocks state changes, and restores", async () => {
    const id = newProject();
    await asOwner(request(app).post(`/splits/${id}/archive`)).send({ reason: "done" }).expect(200);
    expect((await request(app).get(`/splits/${id}/lifecycle`)).body.archived).toBe(true);

    for (const action of ["fund", "distribute", "edit_collaborators", "cancel"] as const) {
      await expect(assertProjectActionAllowed(id, action)).rejects.toMatchObject({ code: "PROJECT_ARCHIVED" });
    }
    const second = await asOwner(request(app).post(`/splits/${id}/archive`)).send({}).expect(409);
    expect(second.body.code).toBe("PROJECT_ARCHIVED");

    await asOwner(request(app).post(`/splits/${id}/restore`)).send({}).expect(200);
    await expect(assertProjectActionAllowed(id, "distribute")).resolves.toBeUndefined();
    const notArchived = await asOwner(request(app).post(`/splits/${id}/restore`)).send({}).expect(409);
    expect(notArchived.body.code).toBe("NOT_ARCHIVED");
  });
});
