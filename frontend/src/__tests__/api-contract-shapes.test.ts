import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError, unwrapProjectList } from "../lib/api-client";

/**
 * Regression coverage for frontend/backend response-shape mismatches:
 * - GET /splits answers `{ projects, total, nextCursor }`, which the client
 *   used to `.map` as if it were an array (dashboard and project list broke).
 * - GET /splits/admin/allowlist reports the total as `count`, which the client
 *   read as `allowedTokenCount` (always undefined).
 */

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function rawProject(id: string) {
  return {
    project_id: id,
    title: id,
    project_type: "music",
    token: "CTOKEN",
    owner: "GOWNER",
    collaborators: [],
    locked: false,
    total_distributed: "0",
    distribution_round: 0,
    balance: "0",
  };
}

describe("unwrapProjectList", () => {
  it("accepts the backend envelope", () => {
    expect(unwrapProjectList({ projects: [{ a: 1 }], total: 1, nextCursor: null })).toEqual([{ a: 1 }]);
  });

  it("still accepts a bare array from older backends", () => {
    expect(unwrapProjectList([{ a: 1 }])).toEqual([{ a: 1 }]);
  });

  it("rejects an unexpected shape instead of crashing later", () => {
    expect(() => unwrapProjectList({ items: [] })).toThrow(ApiError);
  });
});

describe("ApiClient project listing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("maps the projects inside the list envelope", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ projects: [rawProject("p1"), rawProject("p2")], total: 2, nextCursor: null }),
    );

    const projects = await new ApiClient().listProjects({ start: 0, limit: 10 });

    expect(projects.map((p) => p.projectId)).toEqual(["p1", "p2"]);
  });

  it("pages through every project instead of stopping at the backend's default page size", async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, i) => rawProject(`p${start + i}`));
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ projects: page(0, 100), total: 150 }))
      .mockResolvedValueOnce(jsonResponse({ projects: page(100, 50), total: 150 }));

    const projects = await new ApiClient().getAllSplits();

    expect(projects).toHaveLength(150);
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls[0]).toContain("start=0&limit=100");
    expect(urls[1]).toContain("start=100&limit=100");
  });
});

describe("ApiClient admin allowlist", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("maps the backend `count` field to allowedTokenCount", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ admin: "GADMIN", count: 3, tokens: ["C1", "C2", "C3"] }),
    );

    const state = await new ApiClient().getTokenAllowlist(0, 100);

    expect(state).toEqual({ admin: "GADMIN", allowedTokenCount: 3, tokens: ["C1", "C2", "C3"], start: 0, limit: 100 });
  });
});
