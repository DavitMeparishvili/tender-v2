import { Suspense } from "react";
import type { Locale } from "../../localization/config";
import { getMessages } from "../../localization/get-messages";
import { searchPublishedTenders } from "../../tenders/application/search-published-tenders";
import type { PublicTenderSummary } from "../../tenders/domain/masking";
import type { TenderAiContext } from "../../tenders/ui/tender-ai-answers";
import { TenderAiChat } from "../../tenders/ui/tender-ai-chat";
import { formatTenderMoney } from "../../tenders/ui/tender-format";
import { loadLoungeStrip } from "../../vip/application/load-lounge-strip";
import type { VipPartner } from "../../vip/domain/partner";

/**
 * Tender AI gets plain facts only: the newest open tenders and the VIP
 * partners the lounge strip shows.
 */
export function homeAiContext(
  data: Readonly<{
    tenders: readonly PublicTenderSummary[];
    partners: readonly VipPartner[];
  }>,
  locale: Locale,
): Extract<TenderAiContext, { kind: "home" }> {
  const newest = [...data.tenders]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 3);
  return {
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
    partners: data.partners.slice(0, 3).map((partner) => ({
      name: partner.name,
      specialty: partner.serviceLabel,
      href: `/${locale}/profiles/${partner.userId}`,
    })),
    links: {
      tenders: `/${locale}/provider/tenders`,
      partners: `/${locale}/partners`,
      post: `/${locale}/client/tenders/new`,
    },
  };
}

/**
 * The home-page Tender AI for pages without a more specific context. It loads
 * its own facts behind a boundary, so it never delays or breaks the page; a
 * failed read just leaves the matching answer empty.
 */
export function HomeAiChat({ locale }: Readonly<{ locale: Locale }>) {
  return (
    <Suspense fallback={null}>
      <LoadedHomeAiChat locale={locale} />
    </Suspense>
  );
}

async function LoadedHomeAiChat({ locale }: Readonly<{ locale: Locale }>) {
  const [tenders, lounge] = await Promise.all([
    searchPublishedTenders({}).then(
      (search) => (search.ok ? search.value : []),
      (error: unknown) => {
        console.error("Tender AI tenders could not be loaded.", error);
        return [];
      },
    ),
    loadLoungeStrip({ locale, now: new Date() }),
  ]);
  return (
    <TenderAiChat
      copy={getMessages(locale).detail.ai}
      context={homeAiContext({ tenders, partners: lounge.partners }, locale)}
    />
  );
}
