import Link from "next/link";
import type { BidSummary } from "../../bidding/domain/bid-summary";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { DeadlineCountdown } from "../../shell/ui/deadline-countdown";
import { searchPublishedTenders } from "../application/search-published-tenders";
import type { PublicTenderSummary } from "../domain/masking";
import {
  parseDiscoverySearchParams,
  type DiscoverySearchParams,
} from "./discovery-query";
import {
  paginateTenders,
  parseDiscoveryView,
  sortTenders,
  type DiscoveryPage,
} from "./discovery-view";
import { DiscoveryPager, DiscoveryToolbar } from "./discovery-toolbar";
import { formatTenderDate, formatTenderMoney } from "./tender-format";
import { serviceLabel, specialtyLabel } from "./tender-taxonomy";
import { specialtyTone } from "./tender-tone";

type DiscoveryResult =
  | Readonly<{ ok: true; value: readonly PublicTenderSummary[] }>
  | Readonly<{ ok: false }>;

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function DiscoveryResultCard({
  locale,
  messages,
  summary,
  tender,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  summary?: BidSummary | undefined;
  tender: PublicTenderSummary;
}>) {
  const href = `/${locale}/provider/tenders/${tender.id}`;
  const location = tender.district
    ? `${tender.city}, ${tender.district}`
    : tender.city;
  const lowest = formatTenderMoney(
    summary?.lowestAmountMinorUnits ?? null,
    tender.currency,
    locale,
  );
  const offers =
    summary === undefined || summary.bidCount === 0 || lowest === null
      ? messages.discovery.noOffers
      : messages.discovery.offerSummary
          .replace("{count}", String(summary.bidCount))
          .replace("{amount}", lowest);

  return (
    <article className="result-card">
      <div className="result-card-top">
        <div className="result-card-main">
          <div className="result-card-tags">
            <span className={specialtyTone(tender.specialty)}>
              {specialtyLabel(tender.specialty, messages)}
            </span>
            <DeadlineCountdown
              closedLabel={messages.discovery.closed}
              deadline={tender.deadline}
              locale={locale}
              messages={messages}
              template={messages.discovery.leftToBid}
            />
          </div>
          <h2 className="result-card-title">
            <Link href={href}>{tender.title}</Link>
          </h2>
          <p className="result-card-desc">{tender.shortDescription}</p>
        </div>
        <div className="result-card-money">
          <div className="figure-label">{messages.tenders.budget}</div>
          <div className="result-card-amount">
            {formatTenderMoney(
              tender.budgetMinorUnits,
              tender.currency,
              locale,
            ) ?? messages.tenders.notProvided}
          </div>
          <div className="result-card-offers">{offers}</div>
        </div>
      </div>
      <dl className="result-card-foot">
        <Fact
          label={messages.tenders.filterService}
          value={serviceLabel(tender.serviceCode, messages)}
        />
        <Fact label={messages.tenders.approximateLocation} value={location} />
        <Fact
          label={messages.tenders.publishedAt}
          value={
            formatTenderDate(tender.publishedAt, locale) ??
            messages.tenders.notProvided
          }
        />
        <Fact
          label={messages.tenders.deadline}
          value={
            formatTenderDate(tender.deadline, locale) ??
            messages.tenders.notProvided
          }
        />
        <Link className="pill pill-outline" href={href}>
          {messages.tenders.viewDetail}
        </Link>
      </dl>
    </article>
  );
}

export function DiscoveryListContent({
  locale,
  messages,
  result,
  summaries,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  result: DiscoveryResult;
  summaries?: ReadonlyMap<string, BidSummary>;
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
    <ul className="result-list">
      {result.value.map((tender) => (
        <li key={tender.id}>
          <DiscoveryResultCard
            locale={locale}
            messages={messages}
            summary={summaries?.get(tender.id)}
            tender={tender}
          />
        </li>
      ))}
    </ul>
  );
}

export async function DiscoveryList({
  locale,
  messages,
  pathname,
  searchParams,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  pathname: string;
  searchParams: DiscoverySearchParams;
}>) {
  const parsed = parseDiscoverySearchParams(searchParams);
  const result = parsed.ok
    ? await searchPublishedTenders(parsed.value)
    : ({ ok: false } as const);

  if (!result.ok) {
    return (
      <DiscoveryListContent
        locale={locale}
        messages={messages}
        result={{ ok: false }}
      />
    );
  }

  const view = parseDiscoveryView(searchParams);
  const paged: DiscoveryPage = paginateTenders(
    sortTenders(result.value, view.sort),
    view,
  );

  const { listBidSummaries } =
    await import("../../bidding/application/list-bid-summaries");
  const summaries = await listBidSummaries(
    paged.items.map((tender) => ({
      id: tender.id,
      currency: tender.currency,
      deadline: new Date(tender.deadline),
    })),
  );

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }

  return (
    <>
      <DiscoveryToolbar
        messages={messages}
        pathname={pathname}
        searchParams={query}
        total={paged.total}
        view={view}
      />
      <DiscoveryListContent
        locale={locale}
        messages={messages}
        result={{ ok: true, value: paged.items }}
        summaries={summaries}
      />
      <DiscoveryPager
        messages={messages}
        page={paged}
        pathname={pathname}
        searchParams={query}
        view={view}
      />
    </>
  );
}
