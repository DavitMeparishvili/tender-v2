import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { searchPublishedTenders } from "../application/search-published-tenders";
import type { PublicTenderSummary } from "../domain/masking";
import {
  parseDiscoverySearchParams,
  type DiscoverySearchParams,
} from "./discovery-query";
import { formatTenderDate, formatTenderMoney } from "./tender-format";
import { serviceLabel } from "./tender-taxonomy";

type DiscoveryResult =
  | Readonly<{ ok: true; value: readonly PublicTenderSummary[] }>
  | Readonly<{ ok: false }>;

export function DiscoveryListContent({
  locale,
  messages,
  result,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  result: DiscoveryResult;
}>) {
  if (!result.ok) {
    return (
      <section className="tender-empty" role="alert">
        <p>{messages.tenders.errors.invalidInput}</p>
      </section>
    );
  }

  if (result.value.length === 0) {
    return (
      <section
        className="tender-empty"
        aria-label={messages.tenders.providerListEmpty}
      >
        <p>{messages.tenders.providerListEmpty}</p>
      </section>
    );
  }

  return (
    <ul className="tender-list discovery-list">
      {result.value.map((tender) => {
        const href = `/${locale}/provider/tenders/${tender.id}`;
        const location = tender.district
          ? `${tender.city}, ${tender.district}`
          : tender.city;

        return (
          <li key={tender.id}>
            <div className="tender-list-heading">
              <h2>{tender.title}</h2>
            </div>
            <p className="discovery-summary">{tender.shortDescription}</p>
            <dl className="tender-list-facts discovery-list-facts">
              <div>
                <dt>{messages.tenders.filterService}</dt>
                <dd>{serviceLabel(tender.serviceCode, messages)}</dd>
              </div>
              <div>
                <dt>{messages.tenders.budget}</dt>
                <dd>
                  {formatTenderMoney(
                    tender.budgetMinorUnits,
                    tender.currency,
                    locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>{messages.tenders.approximateLocation}</dt>
                <dd>{location}</dd>
              </div>
              <div>
                <dt>{messages.tenders.publishedAt}</dt>
                <dd>
                  {formatTenderDate(tender.publishedAt, locale) ??
                    messages.tenders.notProvided}
                </dd>
              </div>
              <div>
                <dt>{messages.tenders.deadline}</dt>
                <dd>
                  {formatTenderDate(tender.deadline, locale) ??
                    messages.tenders.notProvided}
                </dd>
              </div>
            </dl>
            <div className="tender-row-actions">
              <Link href={href}>{messages.tenders.viewDetail}</Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export async function DiscoveryList({
  locale,
  messages,
  searchParams,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  searchParams: DiscoverySearchParams;
}>) {
  const parsed = parseDiscoverySearchParams(searchParams);
  const result = parsed.ok
    ? await searchPublishedTenders(parsed.value)
    : ({ ok: false } as const);

  return (
    <DiscoveryListContent locale={locale} messages={messages} result={result} />
  );
}
