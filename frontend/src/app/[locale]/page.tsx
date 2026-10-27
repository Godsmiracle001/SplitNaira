import { setRequestLocale } from "next-intl/server";

import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LandingPage />;
}
