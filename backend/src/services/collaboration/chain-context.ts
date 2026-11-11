/**
 * On-chain sources for the collaboration routes' project context.
 *
 * The contract is the source of truth for who owns a project and who is on
 * it. Collaborators carry no role on-chain, so they resolve as viewers
 * (see resolveRole in permissions.ts).
 */
import { fetchProjectById } from "../splits.service.js";
import type { ProjectRoleContext } from "./permissions.js";
import type { ProjectFinancialSnapshot } from "./project-deletion.js";

type OnChainProject = {
  owner?: unknown;
  collaborators?: unknown;
  balance?: unknown;
  total_distributed?: unknown;
  distribution_round?: unknown;
};

async function readProject(projectId: string): Promise<OnChainProject | null> {
  const project = await fetchProjectById(projectId);
  return project && typeof project === "object" ? (project as OnChainProject) : null;
}

function toBigInt(value: unknown): bigint {
  try {
    return typeof value === "bigint" ? value : BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}

export async function resolveRoleContextFromChain(projectId: string): Promise<ProjectRoleContext | null> {
  const project = await readProject(projectId);
  if (!project || typeof project.owner !== "string") return null;
  const collaborators = Array.isArray(project.collaborators)
    ? project.collaborators
        .map((c) => (c && typeof c === "object" ? (c as { address?: unknown }).address : undefined))
        .filter((address): address is string => typeof address === "string")
        .map((address) => ({ address }))
    : [];
  return { owner: project.owner, collaborators };
}

/**
 * Conservative: any balance or past distribution counts as financial
 * history, which blocks hard deletion. Claims are not separately visible
 * on-chain, so they are assumed whenever anything has been distributed.
 */
export async function resolveDeletionSnapshotFromChain(
  projectId: string,
): Promise<ProjectFinancialSnapshot | null> {
  const project = await readProject(projectId);
  if (!project) return null;
  const balance = toBigInt(project.balance);
  const distributed = toBigInt(project.total_distributed);
  const rounds = Number(toBigInt(project.distribution_round));
  return {
    projectId,
    hasDeposits: balance > 0n || distributed > 0n,
    hasDistributions: distributed > 0n || rounds > 0,
    hasClaims: distributed > 0n,
    transactionCount: rounds,
    totalVolumeStroops: (balance + distributed).toString(),
  };
}
