import { notFound } from "next/navigation";
import { listBidSummaries } from "@/src/modules/bidding/application/list-bid-summaries";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import {
  getMarketplaceOverview,
  listRecentPublishedReviews,
} from "@/src/modules/shell/application/marketplace-overview";
import { pickHeroTender } from "@/src/modules/shell/ui/hero-tender";
import { LandingPage } from "@/src/modules/shell/ui/landing-page";
import { searchPublishedTenders } from "@/src/modules/tenders/application/search-published-tenders";
import { TenderAiChat } from "@/src/modules/tenders/ui/tender-ai-chat";
import { formatTenderMoney } from "@/src/modules/tenders/ui/tender-format";
import { loadLoungeStrip } from "@/src/modules/vip/application/load-lounge-strip";

// This page reads the live marketplace database. It must be rendered when a
// request arrives, not while the Docker image is being built.
export const dynamic = "force-dynamic";

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

  const [overview, search, reviews, lounge] = await Promise.all([
    getMarketplaceOverview(),
    searchPublishedTenders({}),
    listRecentPublishedReviews(3),
    loadLoungeStrip({ locale, now: new Date() }),
  ]);

  const tenders = search.ok ? search.value : [];

  // The open-tenders rows (first three) and the hero preview (newest by
  // publication, which VIP-first ordering can push past the first three) both
  // show offer counts, so both need a summary.
  const shown = new Map(
    [...tenders.slice(0, 3), pickHeroTender(tenders)]
      .filter((tender) => tender !== undefined)
      .map((tender) => [tender.id, tender]),
  );
  const summaries = await listBidSummaries(
    [...shown.values()].map((tender) => ({
      id: tender.id,
      currency: tender.currency,
      deadline: new Date(tender.deadline),
    })),
  );

  // Tender AI gets plain facts only: the newest open tenders and the VIP
  // partners the lounge strip already loaded.
  const newest = [...tenders]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 3);

  return (
    <>
      <LandingPage
        data={{ overview, tenders, summaries, reviews, lounge }}
        locale={locale}
        messages={messages}
      />
      <TenderAiChat
        copy={messages.detail.ai}
        context={{
          kind: "home",
          tenders: newest.map((tender) => ({
            title: tender.title,
            budget: formatTenderMoney(
              tender.budgetMinorUnits,
              tender.currency,
              locale,
            ),
            href: `/${locale}/provider/tenders/${tender.id}`,
          })),
          partners: lounge.partners.slice(0, 3).map((partner) => ({
            name: partner.name,
            specialty: partner.serviceLabel,
            href: `/${locale}/profiles/${partner.userId}`,
          })),
          links: {
            tenders: `/${locale}/provider/tenders`,
            partners: `/${locale}/partners`,
            post: `/${locale}/client/tenders/new`,
          },
        }}
      />
    </>
  );
}
