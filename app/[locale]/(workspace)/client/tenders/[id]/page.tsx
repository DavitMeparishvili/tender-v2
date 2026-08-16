import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
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
  const bidsResult =
    owned.value.status === "DRAFT"
      ? null
      : await listTenderBids(id, routeAccess.actor);
  const bids = bidsResult?.ok ? bidsResult.value : [];

  const comparison =
    bidsResult === null ? undefined : (
      <>
        {owned.value.status === "CLOSED" ? (
          <h2>{messages.bidding.outcomeWinnerTitle}</h2>
        ) : null}
        {owned.value.status === "EXPIRED" ? (
          <h2>{messages.bidding.outcomeExpiredTitle}</h2>
        ) : null}
        <BidComparison
          bids={bids}
          copy={bidComparisonCopy(messages)}
          locale={locale}
        />
      </>
    );

  return (
    <TenderDetail
      actor={routeAccess.actor}
      hasBids={bids.length > 0}
      id={id}
      locale={locale}
      messages={messages}
      tender={owned.value}
      {...(comparison === undefined ? {} : { comparison })}
    />
  );
}
