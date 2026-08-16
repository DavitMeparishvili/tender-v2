import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  formatTenderDate,
  formatTenderMoney,
} from "../../tenders/ui/tender-format";
import type { AgreementView } from "../infrastructure/prisma-agreement-gateway";
import { AgreementActionForm } from "./agreement-action-form";
import { ReviewForm } from "../../reviews/ui/review-form";

function statusLabel(status: AgreementView["status"], messages: Messages) {
  return {
    PENDING_CONFIRMATION: messages.agreements.statusPendingConfirmation,
    AGREED: messages.agreements.statusAgreed,
    IN_PROGRESS: messages.agreements.statusInProgress,
    COMPLETED: messages.agreements.statusCompleted,
    CANCELLED: messages.agreements.statusCancelled,
  }[status];
}

function checkpointText(
  value: Date | null,
  locale: Locale,
  messages: Messages,
) {
  if (value === null) return messages.agreements.waiting;
  const date = formatTenderDate(value, locale);
  return date
    ? messages.agreements.recordedAt.replace("{date}", date)
    : messages.agreements.waiting;
}

function LifecycleCheckpoint({
  complete,
  current,
  label,
  locale,
  messages,
  recordedAt,
}: Readonly<{
  complete: boolean;
  current: boolean;
  label: string;
  locale: Locale;
  messages: Messages;
  recordedAt: Date | null;
}>) {
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={complete ? "is-complete" : ""}
    >
      <span>{label}</span>
      <span>{checkpointText(recordedAt, locale, messages)}</span>
    </li>
  );
}

export function AgreementDetail({
  agreement,
  hasPublishedReview = false,
  locale,
  messages,
}: Readonly<{
  agreement: AgreementView;
  hasPublishedReview?: boolean;
  locale: Locale;
  messages: Messages;
}>) {
  const currentStep =
    agreement.status === "PENDING_CONFIRMATION"
      ? agreement.clientConfirmedAt === null
        ? "client"
        : "provider"
      : agreement.status === "AGREED"
        ? "start"
        : agreement.status === "IN_PROGRESS" || agreement.status === "COMPLETED"
          ? "completion"
          : agreement.status === "CANCELLED"
            ? "cancellation"
            : undefined;
  const deadline = formatTenderDate(agreement.confirmDeadline, locale);

  return (
    <>
      <p className="tender-detail-status">
        {messages.agreements.status}: {statusLabel(agreement.status, messages)}
      </p>
      <dl className="tender-detail">
        <div>
          <dt>{messages.agreements.tender}</dt>
          <dd>{agreement.snapshot.tenderTitle}</dd>
        </div>
        <div>
          <dt>{messages.agreements.winningOffer}</dt>
          <dd>
            {formatTenderMoney(
              agreement.snapshot.amountMinorUnits,
              agreement.snapshot.currency,
              locale,
            )}
          </dd>
        </div>
        <div>
          <dt>{messages.agreements.conditions}</dt>
          <dd>{agreement.snapshot.conditions}</dd>
        </div>
        <div>
          <dt>{messages.agreements.proposedStartDate}</dt>
          <dd>
            {formatTenderDate(agreement.snapshot.proposedStartDate, locale) ??
              messages.tenders.notProvided}
          </dd>
        </div>
        <div>
          <dt>{messages.agreements.duration}</dt>
          <dd>
            {agreement.snapshot.durationDays === null
              ? messages.tenders.notProvided
              : messages.agreements.durationDays.replace(
                  "{count}",
                  new Intl.NumberFormat(locale).format(
                    agreement.snapshot.durationDays,
                  ),
                )}
          </dd>
        </div>
        <div>
          <dt>{messages.agreements.includedCosts}</dt>
          <dd>
            {agreement.snapshot.includedCosts ?? messages.tenders.notProvided}
          </dd>
        </div>
        <div>
          <dt>{messages.agreements.exclusions}</dt>
          <dd>
            {agreement.snapshot.exclusions ?? messages.tenders.notProvided}
          </dd>
        </div>
        <div>
          <dt>{messages.agreements.confirmationDeadline}</dt>
          <dd>
            {deadline ? (
              <time dateTime={agreement.confirmDeadline.toISOString()}>
                {deadline}
              </time>
            ) : null}
          </dd>
        </div>
      </dl>
      <ol className="progress-rail">
        <LifecycleCheckpoint
          complete={agreement.clientConfirmedAt !== null}
          current={currentStep === "client"}
          label={messages.agreements.clientConfirmation}
          locale={locale}
          messages={messages}
          recordedAt={agreement.clientConfirmedAt}
        />
        <LifecycleCheckpoint
          complete={agreement.providerConfirmedAt !== null}
          current={currentStep === "provider"}
          label={messages.agreements.providerConfirmation}
          locale={locale}
          messages={messages}
          recordedAt={agreement.providerConfirmedAt}
        />
        <LifecycleCheckpoint
          complete={agreement.clientStartedAt !== null}
          current={
            currentStep === "start" && agreement.clientStartedAt === null
          }
          label={messages.agreements.clientWorkStarted}
          locale={locale}
          messages={messages}
          recordedAt={agreement.clientStartedAt}
        />
        <LifecycleCheckpoint
          complete={agreement.providerStartedAt !== null}
          current={
            currentStep === "start" && agreement.providerStartedAt === null
          }
          label={messages.agreements.providerWorkStarted}
          locale={locale}
          messages={messages}
          recordedAt={agreement.providerStartedAt}
        />
        <LifecycleCheckpoint
          complete={agreement.clientCompletedAt !== null}
          current={
            currentStep === "completion" && agreement.clientCompletedAt === null
          }
          label={messages.agreements.clientCompletion}
          locale={locale}
          messages={messages}
          recordedAt={agreement.clientCompletedAt}
        />
        <LifecycleCheckpoint
          complete={agreement.providerCompletedAt !== null}
          current={
            currentStep === "completion" &&
            agreement.providerCompletedAt === null
          }
          label={messages.agreements.providerCompletion}
          locale={locale}
          messages={messages}
          recordedAt={agreement.providerCompletedAt}
        />
        <LifecycleCheckpoint
          complete={agreement.cancelledAt !== null}
          current={currentStep === "cancellation"}
          label={messages.agreements.cancellation}
          locale={locale}
          messages={messages}
          recordedAt={agreement.cancelledAt}
        />
      </ol>
      {agreement.canConfirm ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="CONFIRM"
          copy={messages.agreements}
          label={messages.agreements.confirm}
        />
      ) : null}
      {agreement.canAcknowledgeStart ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="ACKNOWLEDGE_START"
          copy={messages.agreements}
          label={messages.agreements.acknowledgeStart}
        />
      ) : null}
      {agreement.canConfirmCompletion ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="CONFIRM_COMPLETION"
          copy={messages.agreements}
          label={messages.agreements.confirmCompletion}
        />
      ) : null}
      {agreement.canDecline ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="DECLINE"
          copy={messages.agreements}
          label={messages.agreements.decline}
        />
      ) : null}
      {agreement.canCancel ? (
        <AgreementActionForm
          agreementId={agreement.id}
          action="CANCEL"
          copy={messages.agreements}
          label={messages.agreements.cancel}
        />
      ) : null}
      {agreement.canReview && !hasPublishedReview ? (
        <section aria-labelledby="review-heading">
          <h2 id="review-heading">{messages.reviews.title}</h2>
          <ReviewForm agreementId={agreement.id} copy={messages.reviews} />
        </section>
      ) : null}
      {agreement.canReview && hasPublishedReview ? (
        <p role="status">{messages.reviews.alreadyReviewed}</p>
      ) : null}
    </>
  );
}
