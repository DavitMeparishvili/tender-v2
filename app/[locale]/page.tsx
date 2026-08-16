import { notFound } from "next/navigation";
import { listBidSummaries } from "@/src/modules/bidding/application/list-bid-summaries";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import {
  getMarketplaceOverview,
  listRecentPublishedReviews,
} from "@/src/modules/shell/application/marketplace-overview";
import { LandingPage } from "@/src/modules/shell/ui/landing-page";
import { searchPublishedTenders } from "@/src/modules/tenders/application/search-published-tenders";

export default async function LocaleHome({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);

  const [overview, search, reviews] = await Promise.all([
    getMarketplaceOverview(),
    searchPublishedTenders({}),
    listRecentPublishedReviews(3),
  ]);

  const tenders = search.ok ? search.value : [];

  const summaries = await listBidSummaries(
    tenders.slice(0, 3).map((tender) => ({
      id: tender.id,
      currency: tender.currency,
      deadline: new Date(tender.deadline),
    })),
  );

  return (
    <LandingPage
      data={{ overview, tenders, summaries, reviews }}
      locale={locale}
      messages={messages}
    />
  );
}
