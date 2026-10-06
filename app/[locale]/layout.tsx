import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "@fontsource/noto-sans-georgian/georgian-400.css";
import "@fontsource/noto-sans-georgian/georgian-500.css";
import "@fontsource/noto-sans-georgian/georgian-600.css";
import "@fontsource/noto-sans-georgian/georgian-700.css";
// Unicode ranges let the browser request only the scripts present on the page,
// including Latin Extended for currency symbols. Fontsource self-hosts the files.
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "../globals.css";
import { SUPPORTED_LOCALES, isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { SiteFooter } from "@/src/modules/shell/ui/site-footer";
import { SiteHeader } from "@/src/modules/shell/ui/site-header";
import type { ShellViewer } from "@/src/modules/shell/ui/nav-model";
import { MobileContentInsets } from "@/src/modules/shell/ui/mobile-content-insets";

const directionContract = `<!--
THESIS: A marketplace earns trust by showing live supply and the exact mechanism that closes a tender, so the interface leads with open work, real figures and the deadline that decides the winner.
OWN-WORLD: Near-black ink and paper carry the page, emerald is the single pop and carries contrast-safe white action labels, a faint hairline grid motif marks supporting bands, and soft cool shado[...]
STORY: Land on live tenders, filter discovery down to the work you actually do, meet the paid unlock gate on one tender, then judge a provider by job-bound reviews.
FIRST VIEWPORT: A 34px ink utility strip and a 68px white nav with an emerald active underline sit above a 1200px content column; the landing opens on a 44px headline, a pill search bar and a live[...]
FORM: Tipalti EU design system — Noto Sans for Latin/Cyrillic and Noto Sans Georgian for Georgian, emerald #047857, 4px spacing grid, radii 4→28 and the pill, shadows xs→xl.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export const metadata: Metadata = {
  title: "Tender Marketplace",
  description: "Construction and repair tenders in Georgia.",
  openGraph: {
    title: "Tender Marketplace",
    description: "Construction and repair tenders in Georgia.",
    type: "website",
    url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/icons/buildings.png`,
        width: 1200,
        height: 630,
        alt: "Tender Marketplace Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tender Marketplace",
    description: "Construction and repair tenders in Georgia.",
    images: [`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/icons/buildings.png`],
  },
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
        <MobileContentInsets />
      </body>
    </html>
  );
}
