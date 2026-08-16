import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAgreementForTender } from "@/src/modules/agreements/application/get-agreement";
import { listTenderBids } from "@/src/modules/bidding/application/list-tender-bids";
import {
  BidComparison,
  bidComparisonCopy,
} from "@/src/modules/bidding/ui/bid-comparison";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getOwnedTender } from "@/src/modules/tenders/application/get-owned-tender";
import { TenderDetail } from "@/src/modules/tenders/ui/tender-detail";
import { resolveCustomerRouteAccess } from "@/src/modules/tenders/ui/customer-route-access";

export default async function ClientTenderDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string; locale: string }> }>) {
  const [{ id, locale }, requestHeaders] = await Promise.all([
    params,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "CUSTOMER");
  const routeAccess = resolveCustomerRouteAccess(access);
  if (routeAccess.kind === "LOGIN") {
    redirect("/" + locale + "/login");
  }
  if (routeAccess.kind === "DENIED") {
    return (
      <WorkspaceDenied
        error={routeAccess.error}
        locale={locale}
        messages={messages}
      />
    );
  }

  const owned = await getOwnedTender(id, routeAccess.actor);
  if (!owned.ok) notFound();

  // No offers can exist against a DRAFT tender, so the comparison slot is
  // only ever built once the tender has been published.
  const [bidsResult, agreement] = await Promise.all([
    owned.value.status === "DRAFT"
      ? Promise.resolve(null)
      : listTenderBids(id, routeAccess.actor),
    getAgreementForTender(id, routeAccess.actor),
  ]);
  const bids = bidsResult?.ok ? bidsResult.value : [];

  const showOutcome =
    agreement.ok ||
    owned.value.status === "CLOSED" ||
    owned.value.status === "EXPIRED";
  const comparison =
    bidsResult === null ? undefined : (
      <>
        {showOutcome ? (
          <section
            className="bid-outcome"
            aria-label={
              owned.value.status === "CLOSED"
                ? messages.bidding.outcomeWinnerTitle
                : owned.value.status === "EXPIRED"
                  ? messages.bidding.outcomeExpiredTitle
                  : messages.workspace.agreements
            }
          >
            {owned.value.status === "CLOSED" ? (
              <h2>{messages.bidding.outcomeWinnerTitle}</h2>
            ) : null}
            {owned.value.status === "EXPIRED" ? (
              <h2>{messages.bidding.outcomeExpiredTitle}</h2>
            ) : null}
            {agreement.ok ? (
              <Link
                className="button button-secondary"
                href={`/${locale}/agreements/${agreement.value.id}`}
              >
                {messages.workspace.agreements}
              </Link>
            ) : null}
          </section>
        ) : null}
        <BidComparison
          bids={bids}
          copy={bidComparisonCopy(messages)}
          locale={locale}
        />
      </>
    );

  // `bids` includes every offer ever made on this tender, including
  // withdrawn ones (the client can see the full history in the comparison
  // table). The cancel-control hint must match the server's own guard
  // (`tenderHasActiveBids`), which only counts bids that are still active —
  // otherwise a withdrawn-down-to-zero tender would stay wrongly "blocked"
  // in the UI even though the server would accept the cancellation.
  const hasActiveBids = bids.some((bid) => bid.status !== "WITHDRAWN");

  return (
    <TenderDetail
      actor={routeAccess.actor}
      hasBids={hasActiveBids}
      id={id}
      locale={locale}
      messages={messages}
      tender={owned.value}
      {...(comparison === undefined ? {} : { comparison })}
    />
  );
}
