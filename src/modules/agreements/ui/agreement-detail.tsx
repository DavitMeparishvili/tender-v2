import type { AgreementView } from "../infrastructure/prisma-agreement-gateway";
import { AgreementActionForm } from "./agreement-action-form";
export function AgreementDetail({ agreement }: { agreement: AgreementView }) {
  return (
    <>
      <p className="tender-detail-status">Status: {agreement.status}</p>
      <dl className="tender-detail">
        <div>
          <dt>Tender</dt>
          <dd>{agreement.snapshot.tenderTitle}</dd>
        </div>
        <div>
          <dt>Winning offer</dt>
          <dd>
            {agreement.snapshot.amountMinorUnits} {agreement.snapshot.currency}
          </dd>
        </div>
        <div>
          <dt>Conditions</dt>
          <dd>{agreement.snapshot.conditions}</dd>
        </div>
        <div>
          <dt>Confirmation deadline</dt>
          <dd>{agreement.confirmDeadline.toLocaleString()}</dd>
        </div>
      </dl>
      <ol className="progress-rail">
        <li className={agreement.clientConfirmedAt ? "is-complete" : ""}>
          Client confirmation
        </li>
        <li className={agreement.providerConfirmedAt ? "is-complete" : ""}>
          Provider confirmation
        </li>
        <li
          aria-current={agreement.status === "IN_PROGRESS" ? "step" : undefined}
        >
          Work in progress
        </li>
        <li
          aria-current={agreement.status === "COMPLETED" ? "step" : undefined}
        >
          Completed
        </li>
      </ol>
      {agreement.canConfirm ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="CONFIRM"
          label="Confirm agreement"
        />
      ) : null}
      {agreement.canAcknowledgeStart ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="ACKNOWLEDGE_START"
          label="Acknowledge start"
        />
      ) : null}
      {agreement.canConfirmCompletion ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="CONFIRM_COMPLETION"
          label="Confirm completion"
        />
      ) : null}
      {agreement.canDecline ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="DECLINE"
          label="Decline agreement"
        />
      ) : null}
      {agreement.canCancel ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="CANCEL"
          label="Cancel agreement"
        />
      ) : null}
    </>
  );
}
