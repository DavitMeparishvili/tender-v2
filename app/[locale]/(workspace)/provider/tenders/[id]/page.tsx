import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
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
import { bidFormCopy } from "@/src/modules/bidding/ui/bid-copy";
import { BidForm } from "@/src/modules/bidding/ui/bid-form";
import { BidSummaryView } from "@/src/modules/bidding/ui/bid-summary-view";
import { getCurrentUser } from "@/src/modules/identity/application/current-user";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { BrandIcon } from "@/src/modules/shell/ui/brand-icon";
import {
  RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
  getEntitledAttachmentDownload,
} from "@/src/modules/tenders/application/get-attachment-download";
import { getTenderForProvider } from "@/src/modules/tenders/application/get-tender-for-provider";
import { listEntitledAttachments } from "@/src/modules/tenders/application/list-tender-attachments";
import { searchPublishedTenders } from "@/src/modules/tenders/application/search-published-tenders";
import { DiscoveryDetailContent } from "@/src/modules/tenders/ui/discovery-detail";
import type { TenderAttachmentView } from "@/src/modules/tenders/ui/tender-detail";
import { formatTenderMoney } from "@/src/modules/tenders/ui/tender-format";
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
  const actor =
    user !== null && user.capabilities.includes("PROVIDER")
      ? { id: user.id }
      : null;

  const view = await getTenderForProvider(id, actor);
  if (!view.ok) notFound();

  const tender = view.value.tender;
  const [summary, ownBid, attachments, agreement, similar] = await Promise.all([
    getBidSummary(id),
    actor === null
      ? Promise.resolve({ ok: true, value: null } as const)
      : getOwnBid(id, actor),
    view.value.disclosure === "FULL" && actor !== null
      ? resolveEntitledAttachments(id, actor)
      : Promise.resolve(undefined),
    actor === null
      ? Promise.resolve({ ok: false, error: "AGREEMENT_NOT_FOUND" } as const)
      : getAgreementForTender(id, actor),
    searchPublishedTenders({ specialty: tender.specialty }),
  ]);

  const bid = ownBid.ok ? ownBid.value : null;
  const isOpen = tender.status === "PUBLISHED";
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
    <div className="band band-grey">
      <div className="band-inner">
        <Link className="back-link" href={`/${locale}/provider/tenders`}>
          {messages.tenders.providerBackToList}
        </Link>

        <div className="detail-layout">
          <main className="detail-main">
            <DiscoveryDetailContent
              {...(attachments === undefined ? {} : { attachments })}
              locale={locale}
              messages={messages}
              view={view.value}
            />

            {/*
              A withdrawn bid keeps its row (submit-bid.ts) and can never be
              revised or resubmitted on this tender (revise-bid.ts and the
              unique (tenderId, providerId) constraint both require an active
              row) — that withdrawal is final is a deliberate program-design
              rule, not a gap. Rendering the Submit/Revise form here would
              offer controls that always fail server-side with BID_NOT_ACTIVE,
              so a withdrawn bid gets its own terminal notice instead.
            */}
            {view.value.disclosure === "FULL" &&
            isOpen &&
            bid?.status !== "WITHDRAWN" ? (
              <BidForm
                copy={bidFormCopy(messages)}
                existing={bid}
                tenderId={id}
              />
            ) : null}
            {view.value.disclosure === "FULL" &&
            isOpen &&
            bid?.status === "WITHDRAWN" ? (
              <p className="tender-action-hint">{messages.bidding.withdrawn}</p>
            ) : null}

            {/*
              The outcome is stated in text, never by colour alone, and it is
              the provider's OWN outcome: a losing bidder is told they lost,
              not who won.
            */}
            {isOpen ? null : (
              <section className="bid-outcome">
                <h2>
                  {tender.status === "EXPIRED"
                    ? messages.bidding.outcomeExpiredTitle
                    : messages.bidding.outcomeWinnerTitle}
                </h2>
                {bid?.status === "WINNER" ? (
                  <p>{messages.bidding.outcomeWonBody}</p>
                ) : null}
                {bid?.status === "LOST" ? (
                  <p>{messages.bidding.outcomeLostBody}</p>
                ) : null}
              </section>
            )}

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
          </main>

          <aside className="detail-rail">
            <EntitlementPanel
              canPurchase={actor !== null}
              copy={entitlementPanelCopy(messages)}
              disclosure={view.value.disclosure}
              loginHref={`/${locale}/login`}
              tenderId={id}
            />

            {summary.ok ? (
              <BidSummaryView
                isOpen={isOpen}
                locale={locale}
                messages={messages}
                summary={summary.value}
              />
            ) : null}

            {/*
              The client is masked by the same server-side projection that
              masks the tender, so this card states the masking rather than
              inventing a profile to fill the space.
            */}
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
                    {messages.detail.privateClient}
                    <span className="tag tag-green">
                      {messages.common.verified}
                    </span>
                  </div>
                  <div className="identity-note">
                    {view.value.disclosure === "FULL"
                      ? messages.detail.identityReleased
                      : messages.detail.identityHidden}
                  </div>
                </div>
              </div>
              <p className="rail-note">{messages.detail.notAvailableYet}</p>
            </section>

            {agreement.ok ? (
              <Link
                className="pill pill-outline pill-block"
                href={`/${locale}/agreements/${agreement.value.id}`}
              >
                {messages.workspace.agreements}
              </Link>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
