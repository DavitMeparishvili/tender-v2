import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import "@fontsource/noto-sans-georgian/georgian-400.css";
import "@fontsource/noto-sans-georgian/georgian-500.css";
import "@fontsource/noto-sans-georgian/georgian-600.css";
import "@fontsource/noto-sans-georgian/georgian-700.css";
import "../globals.css";
import { SUPPORTED_LOCALES, isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { IdentityHeader } from "@/src/modules/identity/ui/identity-shell";

const directionContract = `<!--
THESIS: One centered task makes identity feel deliberate and calm; it refuses the split-screen marketing panel common to marketplace authentication.
OWN-WORLD: White and near-black lead, neutral rules carry structure, emerald means verified trust, red means repair; direct-on-page forms use crisp 1px borders and 8px controls without cards or shadows.
STORY: Choose marketplace intent, prove email ownership, complete the public profile, then enter only the workspace the server authorizes.
FIRST VIEWPORT: A compact persistent header sits above a top-anchored 420–460px column with title, plain guidance, fields, and one full-width primary action; desktop adds negative space and mobile keeps 20–24px gutters.
FORM: Focused Column, selected as the professional Vercel-craft direction; seed key b2510d4e.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export const metadata: Metadata = {
  title: "Tender Marketplace",
  description: "Construction and repair tenders in Georgia.",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);

  return (
    <html lang={locale}>
      <body className={GeistSans.variable}>
        <template
          data-direction-contract=""
          dangerouslySetInnerHTML={{ __html: directionContract }}
        />
        <a className="skip-link" href="#main-content">
          {messages.common.skipToContent}
        </a>
        <IdentityHeader locale={locale} messages={messages} />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
