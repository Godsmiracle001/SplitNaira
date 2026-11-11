/**
 * Off-chain project lifecycle: cancellation (#1304) and archival.
 *
 * Both are records in Postgres, not contract state. The contract has no
 * cancel or archive function, so these block the API from building new
 * transactions for a project; they cannot stop someone calling the contract
 * directly.
 */
import { AppError, ErrorCode, ErrorType } from "../lib/errors.js";
import {
  AlreadyArchivedError,
  NotArchivedError,
  archiveProject,
  assertActionAllowed,
  getLatestArchivalEvent,
  restoreProject,
  type ProjectAction,
} from "./project-archival.service.js";
import {
  AlreadyCancelledError,
  NotCancellableError,
  cancelSplit,
  getCancellation,
} from "./split-cancellation.service.js";
import { fetchProjectById } from "./splits.service.js";
import type { ProjectSnapshot } from "../lib/split-lifecycle.js";

export type { ProjectAction };

function conflict(code: ErrorCode, message: string, action?: string): AppError {
  return new AppError(ErrorType.CONFLICT, code, message, action ? { message, action } : undefined);
}

/**
 * Throws a 409 when the project is cancelled (for funding) or archived (for
 * any state-changing action). Called before building a transaction.
 */
export async function assertProjectActionAllowed(projectId: string, action: ProjectAction): Promise<void> {
  if (action === "fund") {
    const cancellation = await getCancellation(projectId);
    if (cancellation) {
      throw conflict(
        ErrorCode.SPLIT_CANCELLED,
        `This split was cancelled on ${cancellation.cancelledAt.toISOString()} and cannot accept new funding.`,
      );
    }
  }
  try {
    await assertActionAllowed(projectId, action);
  } catch (error) {
    throw conflict(ErrorCode.PROJECT_ARCHIVED, (error as Error).message, "Restore Project");
  }
}

function toSnapshot(projectId: string, project: Record<string, unknown>): ProjectSnapshot {
  const collaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
  return {
    projectId,
    locked: Boolean(project.locked),
    balance: String(project.balance ?? 0),
    totalDistributed: String(project.total_distributed ?? 0),
    distributionRound: Number(project.distribution_round ?? 0),
    collaborators: collaborators as ProjectSnapshot["collaborators"],
  };
}

export async function cancelProject(projectId: string, cancelledBy: string, reason?: string | null) {
  await assertProjectActionAllowed(projectId, "cancel");
  const project = await fetchProjectById(projectId);
  if (!project || typeof project !== "object") {
    throw new AppError(ErrorType.CONTRACT, ErrorCode.NOT_FOUND, `Split project ${projectId} not found.`);
  }
  try {
    return await cancelSplit({
      project: toSnapshot(projectId, project as Record<string, unknown>),
      cancelledBy,
      reason,
    });
  } catch (error) {
    if (error instanceof AlreadyCancelledError) throw conflict(ErrorCode.SPLIT_CANCELLED, error.message);
    if (error instanceof NotCancellableError) throw conflict(ErrorCode.NOT_CANCELLABLE, error.message);
    throw error;
  }
}

export async function archive(projectId: string, archivedBy: string, reason?: string | null) {
  try {
    return await archiveProject({ projectId, archivedBy, reason });
  } catch (error) {
    if (error instanceof AlreadyArchivedError) throw conflict(ErrorCode.PROJECT_ARCHIVED, error.message);
    throw error;
  }
}

export async function restore(projectId: string, restoredBy: string) {
  try {
    return await restoreProject({ projectId, restoredBy });
  } catch (error) {
    if (error instanceof NotArchivedError) throw conflict(ErrorCode.NOT_ARCHIVED, error.message);
    throw error;
  }
}

export async function getProjectLifecycle(projectId: string) {
  const [cancellation, archival] = await Promise.all([
    getCancellation(projectId),
    getLatestArchivalEvent(projectId),
  ]);
  return {
    projectId,
    cancelled: cancellation !== null,
    cancelledAt: cancellation?.cancelledAt.toISOString() ?? null,
    cancelReason: cancellation?.reason ?? null,
    archived: archival !== null && archival.restoredAt === null,
    archivedAt: archival && archival.restoredAt === null ? archival.archivedAt.toISOString() : null,
  };
}
