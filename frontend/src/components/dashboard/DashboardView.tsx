"use client";

import { useMemo, type ReactNode } from "react";
import { clsx } from "clsx";
import {
  ArrowUpRight,
  Coins,
  ExternalLink,
  FolderKanban,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { sanitizeText } from "@/lib/security";
import type { SplitProject } from "@/lib/stellar";
import type {
  TokenAllowlistState,
  UnallocatedBalanceState,
  AdminStatusState,
} from "@/lib/api";
import type { WalletState } from "@/lib/wallet";
import { getTransactionExplorerUrl } from "@/lib/explorer";
import { formatStroops, toBigIntAmount } from "@/lib/amounts";
import { getTokenById } from "@/lib/token-constants";
import { Button } from "../Button";
import { Card, SectionHeader, StatCard, StatusBadge } from "../ui/Card";
import { Skeleton } from "../Skeleton";
import { ProjectCard } from "../ProjectCard";

export interface AllowlistActionResult {
  action: "allow" | "disallow";
  token: string;
  txHash: string | null;
}

type Tab = "dashboard" | "create" | "manage" | "projects";

interface DashboardViewProps {
  wallet: WalletState;
  isContractAdmin: boolean;
  tokenAllowlist: TokenAllowlistState | null;
  isLoadingAllowlist: boolean;
  isUpdatingAllowlist: boolean;
  allowlistTokenInput: string;
  setAllowlistTokenInput: (val: string) => void;
  isValidAllowlistToken: boolean;
  normalizedAllowlistToken: string;
  onSubmitAllowlistAction: (action: "allow" | "disallow") => Promise<unknown>;
  lastAllowlistTx: AllowlistActionResult | null;
  refreshTokenAllowlist: () => Promise<unknown>;
  isLoadingDashboard: boolean;
  dashboardData: SplitProject[];
  userEarnings: Record<string, string>;
  adminStatus: AdminStatusState | null;
  isLoadingAdminStatus: boolean;
  refreshAdminStatus: () => Promise<unknown>;
  showPauseConfirm: boolean;
  setShowPauseConfirm: (val: boolean) => void;
  showUnpauseConfirm: boolean;
  setShowUnpauseConfirm: (val: boolean) => void;
  isSubmittingPause: boolean;
  lastPauseTxHash: string | null;
  onTogglePause: (action: "pause" | "unpause") => Promise<unknown>;
  recoveryTokenInput: string;
  setRecoveryTokenInput: (val: string) => void;
  isLoadingUnallocated: boolean;
  unallocatedError: string | null;
  unallocatedBalance: UnallocatedBalanceState | null;
  onInspectUnallocated: () => Promise<void>;
  recoveryToInput: string;
  setRecoveryToInput: (val: string) => void;
  recoveryAmountInput: string;
  setRecoveryAmountInput: (val: string) => void;
  showRecoveryConfirm: boolean;
  setShowRecoveryConfirm: (val: boolean) => void;
  isSubmittingRecovery: boolean;
  onConfirmRecovery: () => Promise<unknown>;
  lastRecoveryTxHash: string | null;
  setActiveTab: (tab: Tab) => void;
  setSearchProjectId: (val: string) => void;
  setFetchedProject: (p: SplitProject | null) => void;
  /** Builds explorer links; returns null for an unsupported network so no wrong-chain link is shown. */
  getExplorerUrl?: (hash: string, network: string | null) => string | null;
}

/** Short label for a token contract: its preset code when known, else a truncated address. */
function tokenLabel(token: string): string {
  const known = getTokenById(token);
  if (known) return known.code;
  return token.length > 12 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token;
}

/** Sums an amount field per token. Amounts of different tokens are never added together. */
function sumByToken(
  projects: SplitProject[],
  amountOf: (project: SplitProject) => string | number | null | undefined,
): Array<{ token: string; total: bigint }> {
  const totals = new Map<string, bigint>();
  for (const project of projects) {
    totals.set(project.token, (totals.get(project.token) ?? 0n) + toBigIntAmount(amountOf(project)));
  }
  return Array.from(totals, ([token, total]) => ({ token, total }));
}

function TokenTotals({ totals }: { totals: Array<{ token: string; total: bigint }> }) {
  if (totals.length === 0) return <>0</>;
  if (totals.length === 1) {
    return (
      <>
        {formatStroops(totals[0].total)}{" "}
        <span className="font-sans text-sm font-normal text-muted">{tokenLabel(totals[0].token)}</span>
      </>
    );
  }
  return <>{totals.length} tokens</>;
}

function TokenBreakdown({ totals }: { totals: Array<{ token: string; total: bigint }> }) {
  if (totals.length < 2) return null;
  return (
    <ul className="space-y-0.5">
      {totals.map(({ token, total }) => (
        <li key={token} className="flex justify-between gap-3 tabular-nums">
          <span className="font-mono">{tokenLabel(token)}</span>
          <span>{formatStroops(total)}</span>
        </li>
      ))}
    </ul>
  );
}

function ConfirmedTx({
  title,
  children,
  txHash,
  explorerUrl,
}: {
  title: string;
  children?: ReactNode;
  txHash: string;
  explorerUrl: string | null;
}) {
  return (
    <div role="status" className="rounded-xl border border-success/25 bg-success/5 p-4">
      <p className="text-sm font-semibold text-success">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      <p className="mt-2 break-all font-mono text-xs text-subtle">Tx: {txHash}</p>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          View on Explorer <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

const fieldClass =
  "glass-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm font-mono disabled:opacity-50";
const labelClass = "text-xs font-medium text-muted";

export function DashboardView({
  wallet,
  isContractAdmin,
  tokenAllowlist,
  isLoadingAllowlist,
  isUpdatingAllowlist,
  allowlistTokenInput,
  setAllowlistTokenInput,
  isValidAllowlistToken,
  normalizedAllowlistToken,
  onSubmitAllowlistAction,
  lastAllowlistTx,
  refreshTokenAllowlist,
  isLoadingDashboard,
  dashboardData,
  userEarnings,
  adminStatus,
  isLoadingAdminStatus,
  refreshAdminStatus,
  setShowPauseConfirm,
  setShowUnpauseConfirm,
  isSubmittingPause,
  lastPauseTxHash,
  recoveryTokenInput,
  setRecoveryTokenInput,
  isLoadingUnallocated,
  unallocatedError,
  unallocatedBalance,
  onInspectUnallocated,
  recoveryToInput,
  setRecoveryToInput,
  recoveryAmountInput,
  setRecoveryAmountInput,
  showRecoveryConfirm,
  setShowRecoveryConfirm,
  isSubmittingRecovery,
  onConfirmRecovery,
  lastRecoveryTxHash,
  setActiveTab,
  setSearchProjectId,
  setFetchedProject,
  getExplorerUrl = getTransactionExplorerUrl,
}: DashboardViewProps) {
  const explorerUrl = (hash: string) => getExplorerUrl(hash, wallet.network);

  const balances = useMemo(() => sumByToken(dashboardData, (p) => p.balance), [dashboardData]);
  const distributed = useMemo(
    () => sumByToken(dashboardData, (p) => p.totalDistributed),
    [dashboardData],
  );
  const myProjects = useMemo(
    () =>
      wallet.address
        ? dashboardData.filter((p) => p.collaborators.some((c) => c.address === wallet.address))
        : [],
    [dashboardData, wallet.address],
  );
  const myEarnings = useMemo(
    () => sumByToken(myProjects, (p) => userEarnings[p.projectId]),
    [myProjects, userEarnings],
  );

  const openProject = (project: SplitProject) => {
    setSearchProjectId(project.projectId);
    setFetchedProject(project);
    setActiveTab("manage");
  };

  const unallocatedUnits = unallocatedBalance ? toBigIntAmount(unallocatedBalance.unallocated) : 0n;
  const recoveryUnits = /^\d+$/.test(recoveryAmountInput.trim())
    ? BigInt(recoveryAmountInput.trim())
    : null;
  const canReviewRecovery =
    Boolean(recoveryToInput.trim()) &&
    recoveryUnits !== null &&
    recoveryUnits > 0n &&
    recoveryUnits <= unallocatedUnits;

  return (
    <div className="space-y-8">
      {/* Summary */}
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoadingDashboard ? (
          Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton variant="line" className="w-1/2" />
              <Skeleton variant="line" className="h-8 w-3/4" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Projects"
              value={<span>{dashboardData.length}</span>}
              icon={<FolderKanban className="h-4 w-4" />}
              hint="Split projects on the configured contract."
            />
            <StatCard
              label="Held for payout"
              value={<TokenTotals totals={balances} />}
              icon={<Coins className="h-4 w-4" />}
              hint={
                balances.length > 1 ? <TokenBreakdown totals={balances} /> : "Deposited and not yet distributed."
              }
            />
            <StatCard
              label="Distributed to date"
              value={<TokenTotals totals={distributed} />}
              icon={<ArrowUpRight className="h-4 w-4" />}
              hint={<TokenBreakdown totals={distributed} />}
            />
            <StatCard
              label="Your earnings"
              value={wallet.connected ? <TokenTotals totals={myEarnings} /> : "—"}
              icon={<Wallet className="h-4 w-4" />}
              hint={
                wallet.connected
                  ? `Claimed across ${myProjects.length} project${myProjects.length === 1 ? "" : "s"} you are part of.`
                  : "Connect a wallet to see your share."
              }
            />
          </>
        )}
      </section>

      {/* Quick actions */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-medium text-ink">Start a new royalty split</p>
          <p className="text-sm text-muted">
            Agree shares with collaborators once; every deposit is paid out by the same rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setActiveTab("projects")}>
            Browse projects
          </Button>
          <Button onClick={() => setActiveTab("create")}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Create split
          </Button>
        </div>
      </Card>

      {/* Your projects */}
      {wallet.connected && !isLoadingDashboard && myProjects.length > 0 && (
        <Card className="space-y-5 p-6">
          <SectionHeader
            title="Projects you earn from"
            description="Amounts are what you have received so far, from on-chain claim records."
          />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myProjects.map((p) => (
              <ProjectCard key={p.projectId} project={p} userEarnings={userEarnings[p.projectId] ?? "0"} />
            ))}
          </div>
        </Card>
      )}

      {/* All projects */}
      <Card className="p-6">
        <SectionHeader
          title="Project performance"
          description="Live balances read from the contract. Amounts are in token units (1 unit = 10,000,000 stroops)."
        />
        {!isLoadingDashboard && dashboardData.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-line-strong p-8 text-center">
            <p className="font-medium text-ink">No split projects yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Create the first project to define who gets paid and in what proportion.
            </p>
            <Button className="mt-4" onClick={() => setActiveTab("create")}>
              <Plus aria-hidden="true" className="h-4 w-4" /> Create split
            </Button>
          </div>
        ) : (
          <div className="custom-scrollbar mt-6 -mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Balances and payout rounds per project</caption>
              <thead>
                <tr className="border-b border-line text-xs font-medium uppercase tracking-[0.08em] text-muted">
                  <th scope="col" className="pb-3 pr-4 font-medium">Project</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Category</th>
                  <th scope="col" className="pb-3 pr-4 text-right font-medium">Balance</th>
                  <th scope="col" className="pb-3 pr-4 text-right font-medium">Distributed</th>
                  <th scope="col" className="pb-3 pr-4 text-right font-medium">Rounds</th>
                  <th scope="col" className="pb-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {isLoadingDashboard
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }, (__, j) => (
                          <td key={j} className="py-4 pr-4">
                            <Skeleton variant="line" className="w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : dashboardData.map((p) => (
                      <tr key={p.projectId} className="transition-colors hover:bg-surface-overlay/50">
                        <td className="py-3.5 pr-4">
                          <p className="font-medium text-ink">{sanitizeText(p.title)}</p>
                          <p className="font-mono text-xs text-subtle">{p.projectId}</p>
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-xs capitalize text-muted">
                            {sanitizeText(p.projectType)}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-ink">
                          {formatStroops(p.balance)} <span className="text-subtle">{tokenLabel(p.token)}</span>
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-muted">
                          {formatStroops(p.totalDistributed)}
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-muted">
                          {p.distributionRound}
                        </td>
                        <td className="py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openProject(p)}
                            aria-label={`Manage ${sanitizeText(p.title)}`}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Admin: token allowlist */}
      {wallet.connected && isContractAdmin && tokenAllowlist && (
        <Card className="glass-card space-y-6 p-6">
          <SectionHeader
            eyebrow={<span className="inline-flex items-center gap-1.5"><ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> Admin</span>}
            title="Admin Token Allowlist"
            description="Choose which token contracts new splits may use. Changes are signed by the connected admin wallet."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void refreshTokenAllowlist();
                }}
                disabled={isLoadingAllowlist || isUpdatingAllowlist}
              >
                <RefreshCw aria-hidden="true" className={clsx("h-3.5 w-3.5", isLoadingAllowlist && "animate-spin")} />
                {isLoadingAllowlist ? "Refreshing…" : "Refresh"}
              </Button>
            }
          />
          <dl className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface-sunken p-4">
              <dt className={labelClass}>Contract admin</dt>
              <dd className="mt-2 break-all font-mono text-xs text-ink">{tokenAllowlist.admin ?? "Not set"}</dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-sunken p-4">
              <dt className={labelClass}>Mode</dt>
              <dd className="mt-2">
                <StatusBadge tone={tokenAllowlist.allowedTokenCount > 0 ? "success" : "neutral"}>
                  {tokenAllowlist.allowedTokenCount > 0 ? "Restricted" : "Open"}
                </StatusBadge>
                <p className="mt-2 text-xs text-muted">
                  {tokenAllowlist.allowedTokenCount > 0
                    ? "New splits must use a listed token."
                    : "No tokens listed, so any token address can be used."}
                </p>
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-surface-sunken p-4">
              <dt className={labelClass}>Listed tokens</dt>
              <dd className="mt-2 font-display text-2xl tabular-nums">{tokenAllowlist.allowedTokenCount}</dd>
            </div>
          </dl>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <div>
              <label htmlFor="allowlist-token-input" className={labelClass}>
                Token contract address
              </label>
              <input
                id="allowlist-token-input"
                value={allowlistTokenInput}
                onChange={(event) => setAllowlistTokenInput(event.target.value)}
                placeholder="Enter token address to allow or disallow"
                disabled={isUpdatingAllowlist}
                aria-invalid={Boolean(normalizedAllowlistToken) && !isValidAllowlistToken}
                aria-describedby={normalizedAllowlistToken && !isValidAllowlistToken ? "allowlist-token-error" : undefined}
                className={fieldClass}
              />
              {normalizedAllowlistToken && !isValidAllowlistToken && (
                <p id="allowlist-token-error" className="mt-1.5 text-xs text-danger">
                  Enter a valid Stellar account or contract address.
                </p>
              )}
            </div>
            <Button
              onClick={() => {
                void onSubmitAllowlistAction("allow");
              }}
              disabled={isUpdatingAllowlist || !isValidAllowlistToken}
              loading={isUpdatingAllowlist}
            >
              Allow Token
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void onSubmitAllowlistAction("disallow");
              }}
              disabled={isUpdatingAllowlist || !isValidAllowlistToken}
            >
              Disallow Token
            </Button>
          </div>

          {lastAllowlistTx?.txHash && (
            <ConfirmedTx
              title={lastAllowlistTx.action === "allow" ? "Token allowed — confirmed on ledger" : "Token removed — confirmed on ledger"}
              txHash={lastAllowlistTx.txHash}
              explorerUrl={explorerUrl(lastAllowlistTx.txHash)}
            >
              <span className="break-all font-mono text-ink">{lastAllowlistTx.token}</span>
            </ConfirmedTx>
          )}

          {tokenAllowlist.tokens.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {tokenAllowlist.tokens.map((allowedToken) => (
                <li key={allowedToken} className="break-all px-4 py-3 font-mono text-xs text-ink">
                  {allowedToken}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
              No token addresses are allowlisted yet.
            </p>
          )}
        </Card>
      )}

      {/* Admin: distribution pause */}
      {wallet.connected && isContractAdmin && (
        <Card className="space-y-5 p-6">
          <SectionHeader
            eyebrow="Admin · Emergency control"
            title="Distribution pause"
            description="Stops payouts on every project until resumed. Deposits and balances are not affected."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void refreshAdminStatus();
                }}
                disabled={isLoadingAdminStatus}
              >
                <RefreshCw aria-hidden="true" className={clsx("h-3.5 w-3.5", isLoadingAdminStatus && "animate-spin")} />
                {isLoadingAdminStatus ? "Refreshing…" : "Refresh"}
              </Button>
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-sunken p-4">
            <div className="space-y-1">
              {adminStatus ? (
                <StatusBadge tone={adminStatus.isPaused ? "warning" : "success"}>
                  {adminStatus.isPaused ? "Paused" : "Running"}
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Unknown</StatusBadge>
              )}
              <p className="text-sm text-muted">
                {adminStatus
                  ? adminStatus.isPaused
                    ? "The contract rejects every distribution call."
                    : "Distributions are processed normally."
                  : "Status could not be read from the contract."}
              </p>
            </div>
            {adminStatus && !adminStatus.isPaused ? (
              <Button
                variant="danger"
                onClick={() => setShowPauseConfirm(true)}
                disabled={isSubmittingPause || isLoadingAdminStatus}
              >
                <PauseCircle aria-hidden="true" className="h-4 w-4" /> Pause distributions
              </Button>
            ) : adminStatus ? (
              <Button onClick={() => setShowUnpauseConfirm(true)} disabled={isSubmittingPause || isLoadingAdminStatus}>
                <PlayCircle aria-hidden="true" className="h-4 w-4" /> Resume distributions
              </Button>
            ) : null}
          </div>
          {lastPauseTxHash && (
            <ConfirmedTx
              title="Pause state change confirmed on ledger"
              txHash={lastPauseTxHash}
              explorerUrl={explorerUrl(lastPauseTxHash)}
            />
          )}
        </Card>
      )}

      {/* Admin: unallocated recovery */}
      {wallet.connected && isContractAdmin && (
        <Card className="space-y-5 p-6">
          <SectionHeader
            eyebrow="Admin · Recovery"
            title="Unallocated token recovery"
            description="Recover tokens sent directly to the contract outside any project. Project balances are never touched."
          />
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <label htmlFor="recovery-token-input" className={labelClass}>
                Token contract address
              </label>
              <input
                id="recovery-token-input"
                type="text"
                value={recoveryTokenInput}
                onChange={(e) => setRecoveryTokenInput(e.target.value)}
                placeholder="C…"
                className={fieldClass}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                void onInspectUnallocated();
              }}
              disabled={isLoadingUnallocated || !recoveryTokenInput.trim()}
              loading={isLoadingUnallocated}
            >
              Check balance
            </Button>
          </div>

          {unallocatedError && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {unallocatedError}
            </p>
          )}

          {unallocatedBalance && (
            <div className="space-y-4 rounded-xl border border-line bg-surface-sunken p-4">
              <div>
                <p className={labelClass}>Recoverable</p>
                <p className="mt-1 font-display text-2xl tabular-nums text-ink">
                  {unallocatedUnits.toLocaleString()}{" "}
                  <span className="font-sans text-sm text-muted">stroops ({formatStroops(unallocatedUnits)} tokens)</span>
                </p>
              </div>

              {unallocatedUnits > 0n && !showRecoveryConfirm && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="recovery-to-input" className={labelClass}>
                      Destination address
                    </label>
                    <input
                      id="recovery-to-input"
                      type="text"
                      value={recoveryToInput}
                      onChange={(e) => setRecoveryToInput(e.target.value)}
                      placeholder="G… or C…"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="recovery-amount-input" className={labelClass}>
                      Amount (stroops)
                    </label>
                    <input
                      id="recovery-amount-input"
                      inputMode="numeric"
                      value={recoveryAmountInput}
                      onChange={(e) => setRecoveryAmountInput(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button variant="secondary" onClick={() => setShowRecoveryConfirm(true)} disabled={!canReviewRecovery}>
                      Review recovery
                    </Button>
                  </div>
                </div>
              )}

              {showRecoveryConfirm && recoveryUnits !== null && (
                <div className="space-y-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-semibold text-warning">Review before signing</p>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
                    <dt className="text-muted">Token</dt>
                    <dd className="break-all font-mono text-xs">{unallocatedBalance.token}</dd>
                    <dt className="text-muted">Destination</dt>
                    <dd className="break-all font-mono text-xs">{recoveryToInput}</dd>
                    <dt className="text-muted">Amount</dt>
                    <dd className="font-mono tabular-nums">{recoveryUnits.toLocaleString()} stroops</dd>
                    <dt className="text-muted">Remaining after</dt>
                    <dd className="font-mono tabular-nums">{(unallocatedUnits - recoveryUnits).toLocaleString()} stroops</dd>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        void onConfirmRecovery();
                      }}
                      disabled={isSubmittingRecovery}
                      loading={isSubmittingRecovery}
                    >
                      {isSubmittingRecovery ? "Waiting for confirmation…" : "Sign and recover"}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowRecoveryConfirm(false)} disabled={isSubmittingRecovery}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {lastRecoveryTxHash && (
            <ConfirmedTx
              title="Recovery transaction"
              txHash={lastRecoveryTxHash}
              explorerUrl={explorerUrl(lastRecoveryTxHash)}
            />
          )}
        </Card>
      )}
    </div>
  );
}
