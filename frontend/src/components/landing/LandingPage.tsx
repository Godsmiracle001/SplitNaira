import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Coins,
  FileLock2,
  FolderKanban,
  GitBranch,
  ListChecks,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button-classes";
import { Card } from "@/components/ui/Card";
import { formatStroops, parseTokenAmount, previewDistribution } from "@/lib/amounts";

const REPO_URL = "https://github.com/Split-Naira/SplitNaira";

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink">
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-sm font-bold text-surface"
      >
        S
      </span>
      SplitNaira
    </span>
  );
}

/** Example split rendered in the hero. Computed with the contract's payout rule, clearly labelled as an example. */
async function ExamplePreview() {
  const t = await getTranslations("Landing.preview");
  const deposit = parseTokenAmount("1000");
  const shares =
    previewDistribution(deposit, [
      { address: "artist", alias: t("roles.artist"), basisPoints: 4500 },
      { address: "producer", alias: t("roles.producer"), basisPoints: 4000 },
      { address: "songwriter", alias: t("roles.songwriter"), basisPoints: 1500 },
    ]) ?? [];

  return (
    <Card className="relative overflow-hidden p-5 shadow-[var(--shadow-pop)] sm:p-6">
      <p className="mb-4 inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
        {t("label")}
      </p>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("deposit")}</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
            {formatStroops(deposit)} <span className="text-base font-normal text-muted">XLM</span>
          </p>
          <p className="mt-1 text-sm text-muted">{t("project")}</p>
        </div>
        <Coins aria-hidden="true" className="h-6 w-6 text-primary" />
      </div>

      <div
        className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-surface-sunken"
        role="img"
        aria-label={shares.map((s) => `${s.alias} ${s.basisPoints / 100}%`).join(", ")}
      >
        {shares.map((s, i) => (
          <span
            key={s.address}
            style={{ width: `${s.basisPoints / 100}%` }}
            className={["bg-primary", "bg-info", "bg-accent"][i % 3]}
          />
        ))}
      </div>

      <p className="mt-5 text-xs uppercase tracking-[0.12em] text-muted">{t("payouts")}</p>
      <ul className="mt-2 divide-y divide-line">
        {shares.map((s, i) => (
          <li key={s.address} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true" className={["bg-primary", "bg-info", "bg-accent"][i % 3] + " h-2 w-2 rounded-full"} />
              <span className="text-ink">{s.alias}</span>
              <span className="text-subtle">{(s.basisPoints / 100).toFixed(0)}%</span>
            </span>
            <span className="font-mono tabular-nums text-ink">{formatStroops(s.amount)} XLM</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function LandingPage() {
  const t = await getTranslations("Landing");

  const steps = [
    { key: "one", icon: Wallet },
    { key: "two", icon: Users },
    { key: "three", icon: Coins },
    { key: "four", icon: ArrowRight },
  ] as const;

  const features = [
    { key: "projects", icon: FolderKanban },
    { key: "collaborators", icon: Users },
    { key: "allocation", icon: ListChecks },
    { key: "tracking", icon: ScrollText },
    { key: "transparency", icon: BadgeCheck },
    { key: "control", icon: FileLock2 },
  ] as const;

  const faqs = ["currency", "wallet", "change", "fees", "failed"] as const;
  const trust = ["nonCustodial", "noFee", "openSource", "status"] as const;

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-surface"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
        <nav
          aria-label={t("nav.primary")}
          className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        >
          <Link href="/" aria-label="SplitNaira home">
            <BrandMark />
          </Link>
          <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
            <li><a className="hover:text-ink" href="#how">{t("nav.how")}</a></li>
            <li><a className="hover:text-ink" href="#features">{t("nav.features")}</a></li>
            <li><a className="hover:text-ink" href="#faq">{t("nav.faq")}</a></li>
          </ul>
          <Link href="/app" className={buttonClasses("primary", "sm")}>
            {t("nav.openApp")}
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div>
            <p className="text-sm font-semibold text-primary">{t("hero.eyebrow")}</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app" className={buttonClasses("primary", "lg")}>
                {t("hero.primaryCta")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <a href="#how" className={buttonClasses("secondary", "lg")}>
                {t("hero.secondaryCta")}
              </a>
            </div>
            <p className="mt-4 text-sm text-subtle">{t("hero.note")}</p>
          </div>
          <ExamplePreview />
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="border-t border-line bg-surface-sunken/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="how-title" className="font-display text-3xl font-semibold tracking-tight">{t("how.title")}</h2>
            <p className="mt-2 text-muted">{t("how.subtitle")}</p>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ key, icon: Icon }, index) => (
                <li key={key}>
                  <Card className="h-full p-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-subtle">0{index + 1}</span>
                      <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mt-4 font-semibold text-ink">{t(`how.steps.${key}.title`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t(`how.steps.${key}.body`)}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="features-title" className="font-display text-3xl font-semibold tracking-tight">{t("features.title")}</h2>
          <p className="mt-2 text-muted">{t("features.subtitle")}</p>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ key, icon: Icon }) => (
              <div key={key}>
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface-raised">
                  <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{t(`features.items.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(`features.items.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stellar / trust */}
        <section aria-labelledby="stellar-title" className="border-y border-line bg-surface-sunken/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <Blocks aria-hidden="true" className="h-6 w-6 text-primary" />
              <h2 id="stellar-title" className="mt-4 font-display text-3xl font-semibold tracking-tight">
                {t("stellar.title")}
              </h2>
              <p className="mt-4 leading-relaxed text-muted">{t("stellar.body")}</p>
              <p className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-4 text-sm leading-relaxed text-ink">
                {t("stellar.caveat")}
              </p>
            </div>
            <Card className="self-start p-6">
              <h3 className="font-semibold text-ink">{t("trust.title")}</h3>
              <ul className="mt-4 space-y-3">
                {trust.map((key) => (
                  <li key={key} className="flex gap-3 text-sm text-muted">
                    <BadgeCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {t(`trust.items.${key}`)}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 id="faq-title" className="font-display text-3xl font-semibold tracking-tight">{t("faq.title")}</h2>
          <div className="mt-8 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface-raised">
            {faqs.map((key) => (
              <details key={key} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                  {t(`faq.items.${key}.q`)}
                  <span aria-hidden="true" className="text-xl leading-none text-subtle transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{t(`faq.items.${key}.a`)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <Card className="flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">{t("cta.title")}</h2>
              <p className="mt-1 text-muted">{t("cta.body")}</p>
            </div>
            <Link href="/app" className={buttonClasses("primary", "lg")}>
              {t("cta.button")} <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <BrandMark />
            <p className="mt-2">{t("footer.tagline")}</p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <a className="inline-flex items-center gap-1.5 hover:text-ink" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <GitBranch aria-hidden="true" className="h-4 w-4" /> {t("footer.source")}
              </a>
            </li>
            <li>
              <a className="hover:text-ink" href={`${REPO_URL}/blob/main/SECURITY.md`} target="_blank" rel="noopener noreferrer">
                {t("footer.security")}
              </a>
            </li>
            <li className="text-subtle">{t("footer.rights")}</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
