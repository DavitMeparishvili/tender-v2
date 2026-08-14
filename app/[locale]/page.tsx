import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/src/modules/localization/config";

const pageCopy: Record<Locale, { heading: string; summary: string }> = {
  ka: {
    heading: "სამშენებლო და სარემონტო ტენდერები",
    summary:
      "კლიენტები აქვეყნებენ სამუშაოს მოთხოვნებს, ხოლო შემსრულებლები წარადგენენ შეთავაზებებს.",
  },
  en: {
    heading: "Construction and repair tenders",
    summary: "Clients publish work requirements, and providers submit offers.",
  },
};

export default async function LocaleHome({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy = pageCopy[locale];

  return (
    <section className="page-content" aria-labelledby="page-heading">
      <h1 id="page-heading">{copy.heading}</h1>
      <p>{copy.summary}</p>
    </section>
  );
}
