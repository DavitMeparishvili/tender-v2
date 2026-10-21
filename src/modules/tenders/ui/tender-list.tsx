import Link from "next/link";
import type { TenderActor } from "../application/create-tender-draft";
import {
  listOwnedTenders,
  countOwnedTenderStatuses,
  parseOwnedTenderQuery,
} from "../application/list-owned-tenders";
import type { TenderDraft } from "../domain/tender";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { TenderFact, tenderDate, tenderMoney } from "./tender-heading";
import { TenderSortSelect } from "./tender-sort-select";
import { TenderIcon } from "./tender-icon";
import { tenderPageCopy } from "./tender-page-copy";
import { specialtyLabel, serviceLabel } from "./tender-taxonomy";
import { canEditTender } from "../domain/edit-eligibility";

export function TenderListContent({
  locale,
  messages,
  tenders,
}: {
  locale: Locale;
  messages: Messages;
  tenders: readonly TenderDraft[];
}) {
  const c = tenderPageCopy(locale);
  const labels = {
    DRAFT: messages.tenders.statusDraft,
    PUBLISHED: messages.tenders.statusPublished,
    AWAITING_SELECTION: messages.tenders.statusAwaitingSelection,
    CLOSED: messages.tenders.statusClosed,
    EXPIRED: messages.tenders.statusExpired,
    CANCELLED: messages.tenders.statusCancelled,
  };
  if (!tenders.length)
    return (
      <section className="tender-panel tender-list-empty">
        <TenderIcon name="inbox" size={42} />
        <h2>{c.noMatches}</h2>
        <Link className="tender-button" href={`/${locale}/client/tenders`}>
          {c.clear}
        </Link>
      </section>
    );
  return (
    <ul className="owned-tender-list">
      {tenders.map((tender) => {
        const href = `/${locale}/client/tenders/${tender.id}`;
        const manageable =
          tender.status === "DRAFT" || tender.status === "PUBLISHED";
        const editable = canEditTender(tender, tender.offerCount ?? 0);
        const editHref =
          tender.status === "DRAFT"
            ? `/${locale}/client/tenders/new?tenderId=${tender.id}`
            : `${href}/edit`;
        return (
          <li
            className="tender-panel owned-tender-card"
            key={tender.id}
            data-tender-status={tender.status}
          >
            <div className="tender-panel-heading split">
              <div className="tender-badges">
                <span className="tender-badge category">
                  {specialtyLabel(tender.specialty, messages)}
                </span>
                <span className="tender-badge">{labels[tender.status]}</span>
              </div>
              <details className="tender-overflow">
                <summary
                  className="tender-button icon-only"
                  aria-label={c.more}
                >
                  <TenderIcon name="more" />
                </summary>
                <div>
                  <Link href={`${href}#history`}>{c.history}</Link>
                  {manageable ? (
                    <Link href={`${href}#management`}>
                      {messages.tenders.cancel}
                    </Link>
                  ) : null}
                </div>
              </details>
            </div>
            <h2>
              <Link href={href}>{tender.title}</Link>
            </h2>
            <p className="owned-tender-location">
              <TenderIcon name="pin" />
              {[tender.location?.city, tender.location?.district]
                .filter(Boolean)
                .join(", ") || messages.tenders.notProvided}
              {tender.areaSquareMeters ? (
                <span> · {tender.areaSquareMeters} m²</span>
              ) : null}
              <span className="desktop-label">
                {" "}
                · {serviceLabel(tender.serviceCode, messages)}
              </span>
            </p>
            <dl className="owned-tender-facts">
              <TenderFact
                className="list-budget"
                icon="wallet"
                label={messages.tenders.budget}
              >
                {tenderMoney(tender.budgetMinorUnits, tender.currency, locale)}
              </TenderFact>
              <TenderFact
                className="list-deadline"
                icon="calendar"
                label={messages.tenders.deadline}
              >
                {tenderDate(tender.deadline, locale, true)}
              </TenderFact>
              <TenderFact className="list-offers" icon="team" label={c.offers}>
                {tender.offerCount ?? 0} {c.offersShort.toLowerCase()}
              </TenderFact>
              <TenderFact
                className="list-attachments"
                icon="clip"
                label={messages.tenders.attachments}
              >
                {tender.attachmentCounts?.photos ?? 0} {c.photos} ·{" "}
                {tender.attachmentCounts?.files ?? 0} {c.filesCount}
              </TenderFact>
            </dl>
            <div className="owned-tender-footer">
              <p>
                {messages.tenders.publishedAt}{" "}
                {tenderDate(tender.publishedAt, locale)}
              </p>
              <div>
                {editable ? (
                  <Link className="tender-button" href={editHref}>
                    {c.edit}
                  </Link>
                ) : manageable ? (
                  <button
                    className="tender-button"
                    disabled
                    title={c.editBlocked}
                  >
                    {c.edit}
                  </button>
                ) : null}
                <Link className="tender-button primary" href={href}>
                  {messages.tenders.viewDetail}
                  <TenderIcon name="arrow" size={18} />
                </Link>
              </div>
            </div>
            {manageable && !editable ? (
              <p className="tender-small-note">{c.editBlocked}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
export async function TenderList({
  actor,
  locale,
  messages,
  queryParams = {},
}: {
  actor: TenderActor;
  locale: Locale;
  messages: Messages;
  queryParams?: Record<string, string | string[] | undefined>;
}) {
  const query = parseOwnedTenderQuery(queryParams);
  const [tenders, counts] = await Promise.all([
    listOwnedTenders(actor, query),
    countOwnedTenderStatuses(actor),
  ]);
  const c = tenderPageCopy(locale);
  const filters = [
    ["", c.all],
    ["PUBLISHED", messages.tenders.statusPublished],
    ["AWAITING_SELECTION", messages.tenders.statusAwaitingSelection],
    ["DRAFT", messages.tenders.statusDraft],
    ["CLOSED", messages.tenders.statusClosed],
    ["EXPIRED", messages.tenders.statusExpired],
    ["CANCELLED", messages.tenders.statusCancelled],
  ];
  return (
    <div className="tender-page tender-list-page">
      <div className="tender-container">
        <header className="owned-list-heading">
          <div>
            <h1>{messages.tenders.clientListTitle}</h1>
            <p>{c.listHint}</p>
          </div>
          <Link
            className="tender-button primary"
            href={`/${locale}/client/tenders/new`}
          >
            <TenderIcon name="plus" />
            {messages.tenders.newTender}
          </Link>
        </header>
        <nav className="owned-status-tabs" aria-label={c.status}>
          {filters.map(([status, label]) => {
            const params = new URLSearchParams({
              ...(query.search ? { search: query.search } : {}),
              sort: query.sort ?? "newest",
              ...(status ? { status } : {}),
            });
            return (
              <Link
                key={status}
                href={`/${locale}/client/tenders?${params}`}
                aria-current={
                  (query.status ?? "") === status ? "page" : undefined
                }
              >
                {label}
                <span>
                  {status
                    ? (counts[status as TenderDraft["status"]] ?? 0)
                    : Object.values(counts).reduce((sum, n) => sum + n, 0)}
                </span>
              </Link>
            );
          })}
        </nav>
        <form className="owned-list-search" method="get">
          <div className="owned-search-field">
            <TenderIcon name="search" />
            <input
              name="search"
              defaultValue={query.search}
              placeholder={c.search}
              aria-label={c.search}
            />
            <button type="submit" className="tender-button small">
              {c.apply}
            </button>
          </div>
          {query.status ? (
            <input type="hidden" name="status" value={query.status} />
          ) : null}
          <label className="owned-sort">
            <span className="sr-only">{c.sort}</span>
            <TenderSortSelect
              value={query.sort ?? "newest"}
              label={c.sort}
              newest={c.newest}
              oldest={c.oldest}
              deadline={c.closing}
            />
          </label>
        </form>
        <TenderListContent
          locale={locale}
          messages={messages}
          tenders={tenders}
        />
        <p className="owned-list-note">
          <TenderIcon name="info" />
          {c.listNote}
        </p>
      </div>
    </div>
  );
}
