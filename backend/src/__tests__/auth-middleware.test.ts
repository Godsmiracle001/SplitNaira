import { Keypair } from "@stellar/stellar-sdk";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  requireStellarAddress,
  requireProjectAccess,
  STELLAR_ADDRESS_HEADER,
} from "../middleware/project-access.js";
import { AppError, ErrorCode, ErrorType } from "../lib/errors.js";
import { sessionHeader } from "../test/auth-helpers.js";

// No database here: treat every wallet as having no stored session version.
vi.mock("../services/session-revocation.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/session-revocation.js")>()),
  getSessionVersion: vi.fn().mockResolvedValue(null),
}));

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    params: {},
    ip: "127.0.0.1",
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(overrides: Partial<Response> = {}): Response {
  return {
    locals: {},
    ...overrides,
  } as unknown as Response;
}

type MockNext = NextFunction & { mock: { calls: unknown[][] } };

function createMockNext(): MockNext {
  return vi.fn() as unknown as MockNext;
}

const VALID_STELLAR_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const ANOTHER_VALID_ADDRESS = Keypair.random().publicKey();
const INVALID_ADDRESS = "not-a-stellar-address";

describe("requireStellarAddress", () => {
  // The requester is the wallet in the session token (issued only after a
  // signed challenge). The header can only assert the same wallet.
  let req: Request;
  let res: Response & { statusCode?: number; body?: unknown };
  let next: MockNext;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse({
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(body: unknown) {
        res.body = body;
        return res;
      },
    } as Partial<Response>) as typeof res;
    next = createMockNext();
  });

  const run = async () => {
    requireStellarAddress(req, res, next);
    // authJwtMiddleware awaits the session-version lookup before calling next.
    await new Promise((resolve) => setImmediate(resolve));
  };

  it("uses the wallet from a valid session token", async () => {
    req.headers.authorization = sessionHeader(VALID_STELLAR_ADDRESS);

    await run();

    expect(res.locals.requesterAddress).toBe(VALID_STELLAR_ADDRESS);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a request with only the header and no session (the old spoofable path)", async () => {
    req.headers[STELLAR_ADDRESS_HEADER] = VALID_STELLAR_ADDRESS;

    await run();

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(res.locals.requesterAddress).toBeUndefined();
  });

  it("rejects a forged or invalid token", async () => {
    req.headers.authorization = "Bearer not.a.jwt";

    await run();

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a header that matches the session wallet (trimmed)", async () => {
    req.headers.authorization = sessionHeader(VALID_STELLAR_ADDRESS);
    req.headers[STELLAR_ADDRESS_HEADER] = `  ${VALID_STELLAR_ADDRESS}  `;

    await run();

    expect(res.locals.requesterAddress).toBe(VALID_STELLAR_ADDRESS);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a header naming a different wallet than the session", async () => {
    req.headers.authorization = sessionHeader(VALID_STELLAR_ADDRESS);
    req.headers[STELLAR_ADDRESS_HEADER] = ANOTHER_VALID_ADDRESS;

    await run();

    const error = next.mock.calls[0][0] as AppError;
    expect(error.type).toBe(ErrorType.AUTH);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(res.locals.requesterAddress).toBeUndefined();
  });

  it("returns a validation error for a malformed header", async () => {
    req.headers.authorization = sessionHeader(VALID_STELLAR_ADDRESS);
    req.headers[STELLAR_ADDRESS_HEADER] = INVALID_ADDRESS;

    await run();

    const error = next.mock.calls[0][0] as AppError;
    expect(error.type).toBe(ErrorType.VALIDATION);
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toContain("Invalid Stellar address");
  });
});

describe("requireProjectAccess", () => {
  let req: Request;
  let res: Response;
  let next: MockNext;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  it("should call next when projectId param is missing", async () => {
    res.locals.requesterAddress = VALID_STELLAR_ADDRESS;
    req.params = {};

    const middleware = requireProjectAccess(async () => null);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should call next when project does not exist (resolveProject returns null)", async () => {
    res.locals.requesterAddress = VALID_STELLAR_ADDRESS;
    req.params = { projectId: "non-existent-project" };

    const resolveProject = vi.fn().mockResolvedValue(null);
    const middleware = requireProjectAccess(resolveProject);
    await middleware(req, res, next);

    expect(resolveProject).toHaveBeenCalledWith("non-existent-project");
    expect(next).toHaveBeenCalledWith();
  });

  it("should allow access when requester is the project owner", async () => {
    res.locals.requesterAddress = VALID_STELLAR_ADDRESS;
    req.params = { projectId: "proj-1" };

    const resolveProject = vi.fn().mockResolvedValue({
      owner: VALID_STELLAR_ADDRESS,
      collaborators: [],
    });
    const middleware = requireProjectAccess(resolveProject);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should allow access when requester is a collaborator", async () => {
    res.locals.requesterAddress = ANOTHER_VALID_ADDRESS;
    req.params = { projectId: "proj-2" };

    const resolveProject = vi.fn().mockResolvedValue({
      owner: VALID_STELLAR_ADDRESS,
      collaborators: [ANOTHER_VALID_ADDRESS, "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"],
    });
    const middleware = requireProjectAccess(resolveProject);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should deny access when requester is neither owner nor collaborator", async () => {
    res.locals.requesterAddress = ANOTHER_VALID_ADDRESS;
    req.params = { projectId: "proj-3" };

    const resolveProject = vi.fn().mockResolvedValue({
      owner: VALID_STELLAR_ADDRESS,
      collaborators: ["GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"],
    });
    const middleware = requireProjectAccess(resolveProject);
    await middleware(req, res, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.type).toBe(ErrorType.AUTH);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(error.message).toBe("You are not authorized to access this project.");
  });

  it("should pass errors from resolveProject to next", async () => {
    res.locals.requesterAddress = VALID_STELLAR_ADDRESS;
    req.params = { projectId: "proj-4" };

    const dbError = new Error("Database connection failed");
    const resolveProject = vi.fn().mockRejectedValue(dbError);
    const middleware = requireProjectAccess(resolveProject);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });

  it("should deny access when collaborators list is empty and requester is not owner", async () => {
    res.locals.requesterAddress = ANOTHER_VALID_ADDRESS;
    req.params = { projectId: "proj-5" };

    const resolveProject = vi.fn().mockResolvedValue({
      owner: VALID_STELLAR_ADDRESS,
      collaborators: [],
    });
    const middleware = requireProjectAccess(resolveProject);
    await middleware(req, res, next);

    const error = next.mock.calls[0][0] as AppError;
    expect(error.type).toBe(ErrorType.AUTH);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it("should allow access when owner and collaborator lists contain the requester", async () => {
    res.locals.requesterAddress = VALID_STELLAR_ADDRESS;
    req.params = { projectId: "proj-6" };

    const resolveProject = vi.fn().mockResolvedValue({
      owner: VALID_STELLAR_ADDRESS,
      collaborators: [VALID_STELLAR_ADDRESS],
    });
    const middleware = requireProjectAccess(resolveProject);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
