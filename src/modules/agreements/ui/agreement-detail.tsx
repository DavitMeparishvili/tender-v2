import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { BrandIcon } from "../../shell/ui/brand-icon";
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

/**
 * A step's title says what happened; the chip says whether it has. Putting
 * both in the same muted colour (the old flat list) made a reader compare
 * eight look-alike lines to find the one that mattered. The chip's colour
 * and the "You" tag do that comparison for them.
 */
function PartyRow({
  complete,
  current,
  isViewer,
  label,
  locale,
  messages,
  recordedAt,
}: Readonly<{
  complete: boolean;
  current: boolean;
  isViewer: boolean;
  label: string;
  locale: Locale;
  messages: Messages;
  recordedAt: Date | null;
}>) {
  return (
    <div className={current ? "lifecycle-party is-current" : "lifecycle-party"}>
      <span className="lifecycle-party-label">
        {label}
        {isViewer ? (
          <span className="tag tag-emerald lifecycle-you">
            {messages.agreements.you}
          </span>
        ) : null}
      </span>
      <span className={complete ? "tag tag-green" : "tag tag-grey"}>
        {checkpointText(recordedAt, locale, messages)}
      </span>
    </div>
  );
}

function LifecyclePhase({
  clientComplete,
  clientCurrent,
  clientRecordedAt,
  locale,
  messages,
  providerComplete,
  providerCurrent,
  providerRecordedAt,
  title,
  viewerRole,
}: Readonly<{
  clientComplete: boolean;
  clientCurrent: boolean;
  clientRecordedAt: Date | null;
  locale: Locale;
  messages: Messages;
  providerComplete: boolean;
  providerCurrent: boolean;
  providerRecordedAt: Date | null;
  title: string;
  viewerRole: AgreementView["partyRole"];
}>) {
  const bothComplete = clientComplete && providerComplete;

  return (
    <li
      className={
        bothComplete ? "lifecycle-phase is-complete" : "lifecycle-phase"
      }
    >
      <h3 className="lifecycle-phase-title">
        {bothComplete ? <BrandIcon name="check" size={14} /> : null}
        {title}
      </h3>
      <div className="lifecycle-parties">
        <PartyRow
          complete={clientComplete}
          current={clientCurrent}
          isViewer={viewerRole === "CLIENT"}
          label={messages.agreements.partyClient}
          locale={locale}
          messages={messages}
          recordedAt={clientRecordedAt}
        />
        <PartyRow
          complete={providerComplete}
          current={providerCurrent}
          isViewer={viewerRole === "PROVIDER"}
          label={messages.agreements.partyProvider}
          locale={locale}
          messages={messages}
          recordedAt={providerRecordedAt}
        />
      </div>
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
          : undefined;
  const deadline = formatTenderDate(agreement.confirmDeadline, locale);
  const cancelledByLabel =
    agreement.cancelledAt === null
      ? null
      : agreement.cancelledById === agreement.clientId
        ? messages.agreements.cancelledByClient
        : agreement.cancelledById === agreement.providerId
          ? messages.agreements.cancelledByProvider
          : messages.agreements.cancelledGeneric;

  return (
    <>
      <p
        className="tender-detail-status"
        data-agreement-status={agreement.status}
      >
        <span aria-hidden="true" />
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

      {/*
        Cancellation ends the sequence rather than sitting inside it, so it
        gets its own banner instead of a "Waiting" row alongside every step
        that is actually still in play.
      */}
      {agreement.cancelledAt === null ? null : (
        <div className="cancellation-banner" role="status">
          <span className="tag tag-red">
            {messages.agreements.cancellation}
          </span>
          <p className="cancellation-summary">
            {cancelledByLabel}
            {" · "}
            {formatTenderDate(agreement.cancelledAt, locale)}
          </p>
          {agreement.cancellationExplanation ? (
            <p className="cancellation-explanation">
              {agreement.cancellationExplanation}
            </p>
          ) : null}
        </div>
      )}

      <ol className="lifecycle-rail">
        <LifecyclePhase
          title={messages.agreements.phaseConfirmation}
          clientComplete={agreement.clientConfirmedAt !== null}
          clientCurrent={currentStep === "client"}
          clientRecordedAt={agreement.clientConfirmedAt}
          providerComplete={agreement.providerConfirmedAt !== null}
          providerCurrent={currentStep === "provider"}
          providerRecordedAt={agreement.providerConfirmedAt}
          locale={locale}
          messages={messages}
          viewerRole={agreement.partyRole}
        />
        <LifecyclePhase
          title={messages.agreements.phaseWorkStarted}
          clientComplete={agreement.clientStartedAt !== null}
          clientCurrent={
            currentStep === "start" && agreement.clientStartedAt === null
          }
          clientRecordedAt={agreement.clientStartedAt}
          providerComplete={agreement.providerStartedAt !== null}
          providerCurrent={
            currentStep === "start" && agreement.providerStartedAt === null
          }
          providerRecordedAt={agreement.providerStartedAt}
          locale={locale}
          messages={messages}
          viewerRole={agreement.partyRole}
        />
        <LifecyclePhase
          title={messages.agreements.phaseCompletion}
          clientComplete={agreement.clientCompletedAt !== null}
          clientCurrent={
            currentStep === "completion" && agreement.clientCompletedAt === null
          }
          clientRecordedAt={agreement.clientCompletedAt}
          providerComplete={agreement.providerCompletedAt !== null}
          providerCurrent={
            currentStep === "completion" &&
            agreement.providerCompletedAt === null
          }
          providerRecordedAt={agreement.providerCompletedAt}
          locale={locale}
          messages={messages}
          viewerRole={agreement.partyRole}
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
