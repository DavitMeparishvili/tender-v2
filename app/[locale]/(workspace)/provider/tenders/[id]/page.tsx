import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  EntitlementPanel,
  entitlementPanelCopy,
} from "@/src/modules/access/ui/entitlement-panel";
import {
  getBidSummary,
  getOwnBid,
} from "@/src/modules/bidding/application/get-bid-summary";
import { listBidSummaries } from "@/src/modules/bidding/application/list-bid-summaries";
import { getAgreementForTender } from "@/src/modules/agreements/application/get-agreement";
import { OwnOffer } from "@/src/modules/bidding/ui/own-offer";
import { BidSummaryView } from "@/src/modules/bidding/ui/bid-summary-view";
import { getCurrentUser } from "@/src/modules/identity/application/current-user";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getAttachmentPreviews } from "@/src/modules/tenders/application/get-attachment-previews";
import { tenderPageCopy } from "@/src/modules/tenders/ui/tender-page-copy";
import { TenderIcon } from "@/src/modules/tenders/ui/tender-icon";
import { TenderAiChat } from "@/src/modules/tenders/ui/tender-ai-chat";
import { BrandIcon } from "@/src/modules/shell/ui/brand-icon";
import {
  RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
  getEntitledAttachmentDownload,
} from "@/src/modules/tenders/application/get-attachment-download";
import { isTenderOwnedBy } from "@/src/modules/tenders/application/is-tender-owned-by";
import { getTenderForProvider } from "@/src/modules/tenders/application/get-tender-for-provider";
import { listEntitledAttachments } from "@/src/modules/tenders/application/list-tender-attachments";
import { searchPublishedTenders } from "@/src/modules/tenders/application/search-published-tenders";
import { DiscoveryDetailContent } from "@/src/modules/tenders/ui/discovery-detail";
import type { TenderAttachmentView } from "@/src/modules/tenders/ui/tender-detail";
import {
  formatTenderDate,
  formatTenderMoney,
} from "@/src/modules/tenders/ui/tender-format";
import { specialtyLabel } from "@/src/modules/tenders/ui/tender-taxonomy";
import { specialtyTone } from "@/src/modules/tenders/ui/tender-tone";

async function resolveEntitledAttachments(
  tenderId: string,
  actor: Readonly<{ id: string }>,
): Promise<readonly TenderAttachmentView[]> {
  const listed = await listEntitledAttachments(tenderId, actor);
  if (!listed.ok) return [];

  const resolved = await Promise.all(
    listed.value.map(async (attachment) => {
      const download = await getEntitledAttachmentDownload(
        tenderId,
        attachment.id,
        actor,
        RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
      );
      if (!download.ok) return null;
      return {
        id: attachment.id,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: download.value,
      };
    }),
  );
  return resolved.filter((view) => view !== null);
}

export default async function ProviderTenderDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string; locale: string }> }>) {
  const [{ id, locale }, requestHeaders] = await Promise.all([
    params,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  // The detail page is public: anyone can read it. Only a signed-in user
  // holding the PROVIDER capability is a bidding actor — everyone else (an
  // anonymous visitor or a signed-in CUSTOMER) gets the same masked view a
  // non-entitled provider would see, with no own-bid, agreement, or
  // attachment lookups run on their behalf.
  const user = await getCurrentUser(requestHeaders);
  // An owner always lands on the management view, whichever link they used.
  if (user !== null && (await isTenderOwnedBy(id, user.id))) {
    redirect(`/${locale}/client/tenders/${id}`);
  }
  const actor =
    user !== null && user.capabilities.includes("PROVIDER")
      ? { id: user.id }
      : null;

  const view = await getTenderForProvider(id, actor);
  if (!view.ok) notFound();

  const tender = view.value.tender;
  const clientContact =
    view.value.disclosure === "FULL" ? view.value.clientContact : null;
  const [summary, ownBid, attachments, agreement, similar] = await Promise.all([
    getBidSummary(id),
    actor === null
      ? Promise.resolve({ ok: true, value: null } as const)
      : getOwnBid(id, actor),
    view.value.disclosure === "FULL" && actor !== null
      ? resolveEntitledAttachments(id, actor)
      : getAttachmentPreviews(id),
    actor === null
      ? Promise.resolve({ ok: false, error: "AGREEMENT_NOT_FOUND" } as const)
      : getAgreementForTender(id, actor),
    searchPublishedTenders({ specialty: tender.specialty }),
  ]);

  const bid = ownBid.ok ? ownBid.value : null;
  const isOpen =
    tender.status === "PUBLISHED" && new Date(tender.deadline) > new Date();
  // Bidding is over and the client has not chosen yet.
  const reviewing =
    tender.status === "AWAITING_SELECTION" ||
    (tender.status === "PUBLISHED" && !isOpen);
  const c = tenderPageCopy(locale);
  const similarTenders = (similar.ok ? similar.value : [])
    .filter((candidate) => candidate.id !== id)
    .slice(0, 3);
  const similarSummaries = await listBidSummaries(
    similarTenders.map((candidate) => ({
      id: candidate.id,
      currency: candidate.currency,
      deadline: new Date(candidate.deadline),
    })),
  );

  return (
    <div className="tender-page">
      <div className="tender-container">
        <Link className="tender-back" href={`/${locale}/provider/tenders`}>
          <TenderIcon name="back" size={16} />
          {messages.tenders.providerBackToList}
        </Link>
        <DiscoveryDetailContent
          attachments={attachments}
          locale={locale}
          messages={messages}
          view={view.value}
          sidebar={
            <>
              {" "}
              {actor === null && user !== null ? (
                <section className="tender-panel tender-signin">
                  <h2>
                    <TenderIcon name="lock" />
                    {c.bidTitle}
                  </h2>
                  <p>{c.bidBody}</p>
                  <Link
                    className="tender-button primary"
                    href={`/${locale}/login`}
                  >
                    {c.signIn}
                  </Link>
                </section>
              ) : (
                <EntitlementPanel
                  canPurchase={actor !== null}
                  copy={entitlementPanelCopy(messages)}
                  disclosure={view.value.disclosure}
                  loginHref={`/${locale}/login`}
                  tenderId={id}
                />
              )}
              {summary.ok && summary.value.bidCount === 0 ? (
                <section className="tender-panel tender-competition">
                  <div className="tender-panel-heading split">
                    <h2>{messages.bidding.summaryTitle}</h2>
                    <span className="tender-badge">
                      {isOpen
                        ? messages.detail.competitionOpen
                        : reviewing
                          ? messages.detail.clientReviewing
                          : tender.status === "CLOSED"
                            ? messages.detail.contractorChosen
                            : c.ended}
                    </span>
                  </div>
                  <strong className="tender-offer-count">0</strong>
                  <p>{c.offers.toLowerCase()}</p>
                  <p className="tender-competition-rule">{c.selectionRule}</p>
                </section>
              ) : summary.ok ? (
                <BidSummaryView
                  isOpen={isOpen}
                  reviewing={reviewing}
                  contractorChosen={tender.status === "CLOSED"}
                  locale={locale}
                  messages={messages}
                  summary={summary.value}
                />
              ) : null}
              <section aria-labelledby="client-heading" className="rail-card">
                <h2 className="rail-head" id="client-heading">
                  {messages.detail.aboutClient}
                </h2>
                <div className="identity-row">
                  <span className="identity-avatar">
                    <BrandIcon name="profile" size={20} />
                  </span>
                  <div>
                    <div className="identity-name">
                      {clientContact ? (
                        <Link
                          href={`/${locale}/profiles/${clientContact.userId}`}
                        >
                          {clientContact.displayName}
                        </Link>
                      ) : (
                        messages.detail.privateClient
                      )}
                    </div>
                    <div className="identity-note">
                      {clientContact ? (
                        <>
                          <p>
                            <a href={`mailto:${clientContact.email}`}>
                              {clientContact.email}
                            </a>
                          </p>
                          <p>
                            <a href={`tel:${clientContact.phoneE164}`}>
                              {clientContact.phoneE164}
                            </a>
                          </p>
                        </>
                      ) : (
                        messages.detail.identityHidden
                      )}
                    </div>
                  </div>
                </div>
              </section>
              {agreement.ok ? (
                <Link
                  className="pill pill-outline pill-block"
                  href={`/${locale}/agreements/${agreement.value.id}`}
                >
                  {messages.workspace.agreements}
                </Link>
              ) : null}
            </>
          }
        >
          {bid !== null || (view.value.disclosure === "FULL" && isOpen) ? (
            <OwnOffer
              dates={{
                submitted: formatTenderDate(bid?.createdAt ?? null, locale),
                updated: formatTenderDate(bid?.updatedAt ?? null, locale),
                deadline: formatTenderDate(tender.deadline, locale),
                start: bid?.proposedStartDate
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(bid.proposedStartDate)
                  : null,
              }}
              bid={bid}
              tenderId={id}
              currency={tender.currency}
              deadline={tender.deadline}
              tenderStatus={tender.status}
              canEdit={view.value.disclosure === "FULL" && isOpen}
              locale={locale}
              messages={messages}
            />
          ) : null}

          <section aria-labelledby="similar-heading">
            <h2 className="card-title" id="similar-heading">
              {messages.detail.similarTitle}
            </h2>
            {similarTenders.length === 0 ? (
              <p className="tender-action-hint">
                {messages.detail.similarEmpty}
              </p>
            ) : (
              <ul className="mini-card-grid">
                {similarTenders.map((candidate) => {
                  const candidateSummary = similarSummaries.get(candidate.id);
                  return (
                    <li key={candidate.id}>
                      <Link
                        className="mini-card"
                        href={`/${locale}/provider/tenders/${candidate.id}`}
                      >
                        <span className={specialtyTone(candidate.specialty)}>
                          {specialtyLabel(candidate.specialty, messages)}
                        </span>
                        <span className="mini-card-title">
                          {candidate.title}
                        </span>
                        <span className="mini-card-amount">
                          {formatTenderMoney(
                            candidate.budgetMinorUnits,
                            candidate.currency,
                            locale,
                          ) ?? messages.tenders.notProvided}
                        </span>
                        <span className="mini-card-meta">
                          {candidate.city} ·{" "}
                          {messages.bidding.bidCount.replace(
                            "{count}",
                            String(candidateSummary?.bidCount ?? 0),
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </DiscoveryDetailContent>
        {actor === null ? (
          <div className="tender-mobile-actions public-actions">
            <p>
              <TenderIcon name="lock" size={13} />
              {user !== null ? c.signInNote : messages.entitlements.signInTitle}
            </p>
            <Link className="tender-button primary" href={`/${locale}/login`}>
              {c.signIn}
            </Link>
          </div>
        ) : null}
        <TenderAiChat
          copy={messages.detail.ai}
          context={{
            kind: "tender",
            title: tender.title,
            budget: formatTenderMoney(
              tender.budgetMinorUnits,
              tender.currency,
              locale,
            ),
            offerCount: summary.ok ? summary.value.bidCount : null,
            lowestOffer: summary.ok
              ? formatTenderMoney(
                  summary.value.lowestAmountMinorUnits,
                  summary.value.currency,
                  locale,
                )
              : null,
          }}
        />
      </div>
    </div>
  );
}
