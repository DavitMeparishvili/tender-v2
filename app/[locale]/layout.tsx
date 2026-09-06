import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "@fontsource/noto-sans-georgian/georgian-400.css";
import "@fontsource/noto-sans-georgian/georgian-500.css";
import "@fontsource/noto-sans-georgian/georgian-600.css";
import "@fontsource/noto-sans-georgian/georgian-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "../globals.css";
import { SUPPORTED_LOCALES, isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { SiteFooter } from "@/src/modules/shell/ui/site-footer";
import { SiteHeader } from "@/src/modules/shell/ui/site-header";
import type { ShellViewer } from "@/src/modules/shell/ui/nav-model";

const directionContract = `<!--
THESIS: A marketplace earns trust by showing live supply and the exact mechanism that closes a tender, so the interface leads with open work, real figures and the deadline that decides the winner.
OWN-WORLD: Near-black ink and paper carry the page, gold is the single pop and never carries white text, a 1px hairline grid motif marks every hero and banded surface, and soft cool shadows lift cards without turning them into glass.
STORY: Land on live tenders, filter discovery down to the work you actually do, meet the paid unlock gate on one tender, then judge a provider by job-bound reviews.
FIRST VIEWPORT: A 34px ink utility strip and a 68px white nav with a gold active underline sit above a 1200px content column; the landing opens on a 56px headline, a pill search bar and a live tender card, and every workspace page opens on the same banded column.
FORM: Tipalti EU design system — Manrope for Latin and Noto Sans Georgian for Georgian, gold #FFB600, 4px spacing grid, radii 4→28 and the pill, shadows xs→xl.
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

/*
  The shell needs to know which destinations the viewer may reach, but that
  lookup must never be what breaks a page: a signed-out visitor, an unreadable
  session, or a render outside a request scope all fall back to the public
  navigation. The session modules are imported lazily for the same reason —
  reaching the database is a consequence of having a request, not of rendering
  the layout.
*/
async function readViewer(): Promise<ShellViewer | null> {
  try {
    const [{ headers }, { getCurrentUser }] = await Promise.all([
      import("next/headers"),
      import("@/src/modules/identity/application/current-user"),
    ]);
    const user = await getCurrentUser(await headers());
    if (user === null) return null;
    return {
      displayName: user.displayName,
      capabilities: user.capabilities,
    };
  } catch {
    return null;
  }
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
  const viewer = await readViewer();

  return (
    <html lang={locale}>
      <body>
        <template
          data-direction-contract=""
          dangerouslySetInnerHTML={{ __html: directionContract }}
        />
        <a className="skip-link" href="#main-content">
          {messages.common.skipToContent}
        </a>
        <SiteHeader locale={locale} messages={messages} viewer={viewer} />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter locale={locale} messages={messages} />
      </body>
    </html>
  );
}
