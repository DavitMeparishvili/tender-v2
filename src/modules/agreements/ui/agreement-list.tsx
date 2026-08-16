import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderMoney } from "../../tenders/ui/tender-format";
import type { AgreementView } from "../infrastructure/prisma-agreement-gateway";

const terminalStatuses = new Set(["COMPLETED", "CANCELLED"]);

function statusLabel(status: AgreementView["status"], messages: Messages) {
  return {
    PENDING_CONFIRMATION: messages.agreements.statusPendingConfirmation,
    AGREED: messages.agreements.statusAgreed,
    IN_PROGRESS: messages.agreements.statusInProgress,
    COMPLETED: messages.agreements.statusCompleted,
    CANCELLED: messages.agreements.statusCancelled,
  }[status];
}

function needsAction(agreement: AgreementView) {
  return (
    agreement.canConfirm ||
    agreement.canDecline ||
    agreement.canAcknowledgeStart ||
    agreement.canConfirmCompletion
  );
}

export function AgreementList({
  agreements,
  locale,
  messages,
}: Readonly<{
  agreements: readonly AgreementView[];
  locale: Locale;
  messages: Messages;
}>) {
  if (agreements.length === 0) {
    return <p className="tender-empty">{messages.agreements.empty}</p>;
  }

  const groups = [
    {
      label: messages.agreements.needsAction,
      agreements: agreements.filter(needsAction),
    },
    {
      label: messages.agreements.currentWork,
      agreements: agreements.filter(
        (agreement) =>
          !needsAction(agreement) && !terminalStatuses.has(agreement.status),
      ),
    },
    {
      label: messages.agreements.completedOrCancelled,
      agreements: agreements.filter((agreement) =>
        terminalStatuses.has(agreement.status),
      ),
    },
  ];

  return groups.map((group) =>
    group.agreements.length === 0 ? null : (
      <section key={group.label} className="agreement-list-group">
        <h2>{group.label}</h2>
        <ul className="tender-list">
          {group.agreements.map((agreement) => (
            <li key={agreement.id}>
              <div className="tender-list-heading">
                <h3>
                  <Link href={`/${locale}/agreements/${agreement.id}`}>
                    {agreement.snapshot.tenderTitle}
                  </Link>
                </h3>
                <span className="tender-status">
                  {statusLabel(agreement.status, messages)}
                </span>
              </div>
              <p className="discovery-summary">
                {formatTenderMoney(
                  agreement.snapshot.amountMinorUnits,
                  agreement.snapshot.currency,
                  locale,
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>
    ),
  );
}
