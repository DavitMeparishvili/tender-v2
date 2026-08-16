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
import { bidFormCopy } from "@/src/modules/bidding/ui/bid-copy";
import { BidForm } from "@/src/modules/bidding/ui/bid-form";
import { BidSummaryView } from "@/src/modules/bidding/ui/bid-summary-view";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import {
  RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
  getEntitledAttachmentDownload,
} from "@/src/modules/tenders/application/get-attachment-download";
import { getTenderForProvider } from "@/src/modules/tenders/application/get-tender-for-provider";
import { listEntitledAttachments } from "@/src/modules/tenders/application/list-tender-attachments";
import { DiscoveryDetailContent } from "@/src/modules/tenders/ui/discovery-detail";
import type { TenderAttachmentView } from "@/src/modules/tenders/ui/tender-detail";

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
  const access = await requireCapability(requestHeaders, "PROVIDER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") redirect(`/${locale}/login`);
    return (
      <WorkspaceDenied
        error={access.error}
        locale={locale}
        messages={messages}
      />
    );
  }

  const actor = { id: access.value.id };
  const view = await getTenderForProvider(id, actor);
  if (!view.ok) notFound();

  const [summary, ownBid, attachments] = await Promise.all([
    getBidSummary(id),
    getOwnBid(id, actor),
    view.value.disclosure === "FULL"
      ? resolveEntitledAttachments(id, actor)
      : Promise.resolve(undefined),
  ]);

  const bid = ownBid.ok ? ownBid.value : null;
  const isOpen = view.value.tender.status === "PUBLISHED";

  return (
    <IdentityShell title={view.value.tender.title}>
      <Link className="back-link" href={`/${locale}/provider/tenders`}>
        {messages.tenders.providerBackToList}
      </Link>
      <DiscoveryDetailContent
        {...(attachments === undefined ? {} : { attachments })}
        locale={locale}
        messages={messages}
        view={view.value}
      />
      <EntitlementPanel
        copy={entitlementPanelCopy(messages)}
        disclosure={view.value.disclosure}
        tenderId={id}
      />
      {summary.ok ? (
        <BidSummaryView
          locale={locale}
          messages={messages}
          summary={summary.value}
        />
      ) : null}
      {/*
        A withdrawn bid keeps its row (submit-bid.ts) and can never be
        revised or resubmitted on this tender (revise-bid.ts and the unique
        (tenderId, providerId) constraint both require an active row) — that
        withdrawal is final is a deliberate program-design rule, not a gap.
        Rendering the Submit/Revise form here would offer controls that
        always fail server-side with BID_NOT_ACTIVE, so a withdrawn bid gets
        its own terminal notice instead.
      */}
      {view.value.disclosure === "FULL" &&
      isOpen &&
      bid?.status !== "WITHDRAWN" ? (
        <BidForm copy={bidFormCopy(messages)} existing={bid} tenderId={id} />
      ) : null}
      {view.value.disclosure === "FULL" &&
      isOpen &&
      bid?.status === "WITHDRAWN" ? (
        <p className="tender-action-hint">{messages.bidding.withdrawn}</p>
      ) : null}
      {/*
        The outcome is stated in text, never by colour alone, and it is the
        provider's OWN outcome: a losing bidder is told they lost, not who won.
      */}
      {isOpen ? null : (
        <section className="bid-outcome">
          <h2>
            {view.value.tender.status === "EXPIRED"
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
    </IdentityShell>
  );
}
