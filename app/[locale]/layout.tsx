import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "../globals.css";
import {
  SUPPORTED_LOCALES,
  isLocale,
  type Locale,
} from "@/src/modules/localization/config";

const skipLinkCopy: Record<Locale, string> = {
  ka: "მთავარ შინაარსზე გადასვლა",
  en: "Skip to main content",
};

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

  return (
    <html lang={locale}>
      <body>
        <a className="skip-link" href="#main-content">
          {skipLinkCopy[locale]}
        </a>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
