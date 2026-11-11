/**
 * Project access control middleware (#295).
 *
 * Prevents unauthorized enumeration of private group data by verifying
 * that the requesting Stellar address is either:
 *   1. The project owner, or
 *   2. A listed collaborator on the project
 *
 * The requester is the wallet proven by the session JWT, which is only issued
 * after the wallet signs a challenge (GET /auth/challenge, POST /users/login).
 * An `X-Stellar-Address` header, if sent, must match that wallet.
 *
 * Routes that serve non-sensitive aggregate data (e.g. allowlist, public
 * project list) should NOT apply this middleware.
 */

import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import {
  STELLAR_ADDRESS_HEADER,
  canAccessProject,
  createUnauthorizedProjectAccessError,
  parseStellarAddressHeader,
  type ProjectAccessTarget,
} from "../services/auth.js";
import { logger } from "../services/logger.js";
import { authJwtMiddleware } from "./auth-jwt.js";
import { AppError, ErrorCode, ErrorType } from "../lib/errors.js";

export { STELLAR_ADDRESS_HEADER, type ProjectAccessTarget };

/**
 * Validates that the `X-Stellar-Address` header contains a well-formed
 * Stellar address and attaches it to `res.locals.requesterAddress`.
 *
 * Returns 401 if the header is absent or malformed.
 */
export function requireStellarAddress(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // The requester is the wallet proven by the session token (issued only
  // after a signed challenge, see services/wallet-auth.ts). The header used
  // to be the only source, and anyone could set it to any address.
  void authJwtMiddleware(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    const walletAddress = req.user?.walletAddress;
    if (!walletAddress) {
      next(new AppError(ErrorType.AUTH, ErrorCode.UNAUTHORIZED, "Sign in with your wallet first."));
      return;
    }

    // Still accepted for compatibility, but only as an assertion that must
    // match the signed-in wallet.
    const rawHeader = req.headers[STELLAR_ADDRESS_HEADER] as string | string[] | undefined;
    if (rawHeader !== undefined) {
      const result = parseStellarAddressHeader(rawHeader);
      if (!result.ok) {
        next(result.error);
        return;
      }
      if (result.address !== walletAddress) {
        next(
          new AppError(
            ErrorType.AUTH,
            ErrorCode.UNAUTHORIZED,
            `${STELLAR_ADDRESS_HEADER} does not match the signed-in wallet.`,
          ),
        );
        return;
      }
    }

    res.locals.requesterAddress = walletAddress;
    next();
  });
}

/**
 * Returns a middleware that verifies the requester (from `res.locals.requesterAddress`)
 * is either the project owner or a collaborator.
 *
 * `resolveProject` receives the raw `:projectId` param and should return the
 * access target or `null` when the project does not exist.
 *
 * Usage:
 * ```ts
 * splitsRouter.get(
 *   "/:projectId/private",
 *   requireStellarAddress,
 *   requireProjectAccess(async (id) => fetchProjectAccessTarget(id)),
 *   handler,
 * );
 * ```
 */
export function requireProjectAccess(
  resolveProject: (projectId: string) => Promise<ProjectAccessTarget | null>,
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const requester: string = res.locals.requesterAddress;
    const projectId = req.params.projectId as string | undefined;

    if (!projectId) {
      next();
      return;
    }

    try {
      const target = await resolveProject(projectId);

      if (!target) {
        // Project not found — let the route handler return 404
        next();
        return;
      }

      if (!canAccessProject(requester, target)) {
        const hashedIp = req.ip ? createHash("sha256").update(req.ip).digest("hex").slice(0, 16) : "unknown";
        logger.warn("Unauthorized project access attempt blocked", {
          requester,
          projectId,
          requestId: res.locals.requestId,
          ip: hashedIp,
        });
        next(createUnauthorizedProjectAccessError());
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
