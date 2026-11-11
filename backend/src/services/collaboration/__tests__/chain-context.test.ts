import { describe, expect, it, vi, beforeEach } from "vitest";

const { fetchProjectById } = vi.hoisted(() => ({ fetchProjectById: vi.fn() }));
vi.mock("../../splits.service.js", () => ({ fetchProjectById }));

import { resolveDeletionSnapshotFromChain, resolveRoleContextFromChain } from "../chain-context.js";

const OWNER = "GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H";
const COLLAB = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

beforeEach(() => fetchProjectById.mockReset());

describe("resolveRoleContextFromChain", () => {
  it("takes the owner and collaborators from the on-chain project", async () => {
    fetchProjectById.mockResolvedValue({
      owner: OWNER,
      collaborators: [{ address: COLLAB, alias: "A", basis_points: 10000 }],
    });
    await expect(resolveRoleContextFromChain("p1")).resolves.toEqual({
      owner: OWNER,
      collaborators: [{ address: COLLAB }],
    });
  });

  it("returns null for a missing or malformed project", async () => {
    fetchProjectById.mockResolvedValue(null);
    await expect(resolveRoleContextFromChain("p1")).resolves.toBeNull();
    fetchProjectById.mockResolvedValue({ collaborators: [] });
    await expect(resolveRoleContextFromChain("p1")).resolves.toBeNull();
  });
});

describe("resolveDeletionSnapshotFromChain", () => {
  it("reports no financial history for an untouched project", async () => {
    fetchProjectById.mockResolvedValue({ owner: OWNER, balance: "0", total_distributed: 0n, distribution_round: 0 });
    await expect(resolveDeletionSnapshotFromChain("p1")).resolves.toMatchObject({
      hasDeposits: false,
      hasDistributions: false,
      hasClaims: false,
      transactionCount: 0,
    });
  });

  it("treats a balance or any distribution as financial history", async () => {
    fetchProjectById.mockResolvedValue({ owner: OWNER, balance: "500", total_distributed: 0n, distribution_round: 0 });
    await expect(resolveDeletionSnapshotFromChain("p1")).resolves.toMatchObject({ hasDeposits: true });

    fetchProjectById.mockResolvedValue({ owner: OWNER, balance: "0", total_distributed: 900n, distribution_round: 2 });
    await expect(resolveDeletionSnapshotFromChain("p1")).resolves.toMatchObject({
      hasDeposits: true,
      hasDistributions: true,
      hasClaims: true,
      transactionCount: 2,
      totalVolumeStroops: "900",
    });
  });
});
