import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { listOwnOffers } from "@/src/modules/bidding/application/list-own-offers";
import { offerStatus } from "@/src/modules/bidding/ui/offer-status";
import {
  formatTenderDate,
  formatTenderMoney,
} from "@/src/modules/tenders/ui/tender-format";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

export default async function MyOffersPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "PROVIDER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") redirect(`/${locale}/login`);
    return (
      <>
        <WorkspaceDenied
          error={access.error}
          locale={locale}
          messages={messages}
        />
        <HomeAiChat locale={locale} />
      </>
    );
  }
  const offers = await listOwnOffers(access.value.id);
  const c = messages.bidding.offer;
  return (
    <>
      <div className="tender-page">
        <div className="tender-container">
          <h1>{c.back}</h1>
          <p>{c.intro}</p>
          {offers.length === 0 ? (
            <section className="own-offer">
              <p>{c.empty}</p>
              <Link
                className="tender-button"
                href={`/${locale}/provider/tenders`}
              >
                {messages.nav.discover}
              </Link>
            </section>
          ) : (
            <ul className="own-offer-list">
              {offers.map((offer) => (
                <li className="own-offer" key={offer.id}>
                  <div className="own-offer-heading">
                    <h2>{offer.tender.title}</h2>
                    <span
                      className={`offer-status offer-status-${offerStatus(offer.status, offer.tender.status, offer.tender.deadline ?? new Date(0))}`}
                    >
                      {
                        c.statuses[
                          offerStatus(
                            offer.status,
                            offer.tender.status,
                            offer.tender.deadline ?? new Date(0),
                          )
                        ]
                      }
                    </span>
                  </div>
                  <p className="own-offer-amount">
                    {formatTenderMoney(
                      offer.amountMinorUnits,
                      offer.currency === "GEL" || offer.currency === "USD"
                        ? offer.currency
                        : null,
                      locale,
                    )}
                  </p>
                  <p>
                    {c.deadline}:{" "}
                    {formatTenderDate(offer.tender.deadline, locale) ??
                      c.missing}
                  </p>
                  <p>
                    {c.updatedAt}: {formatTenderDate(offer.updatedAt, locale)}
                  </p>
                  {offer.tender.status === "CANCELLED" ? (
                    <p>{c.cancelledBody}</p>
                  ) : (
                    <Link
                      className="tender-button"
                      href={`/${locale}/provider/tenders/${offer.tenderId}#my-offer`}
                    >
                      {c.view}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <HomeAiChat locale={locale} />
    </>
  );
}
