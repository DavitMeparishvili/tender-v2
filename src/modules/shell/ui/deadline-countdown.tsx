import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderDate } from "../../tenders/ui/tender-format";
import { Countdown } from "./countdown";

/**
 * Server half of the countdown. It resolves only values that do not depend on
 * the current time, so rendering stays pure; the ticking relative figure is
 * the client's job.
 */
export function DeadlineCountdown({
  closedLabel,
  deadline,
  locale,
  messages,
  template,
}: Readonly<{
  closedLabel: string;
  deadline: string;
  locale: Locale;
  messages: Messages;
  template: string;
}>) {
  return (
    <Countdown
      absoluteLabel={formatTenderDate(deadline, locale) ?? deadline}
      closedLabel={closedLabel}
      deadline={deadline}
      template={template}
      units={{
        day: messages.discovery.unitDay,
        hour: messages.discovery.unitHour,
        minute: messages.discovery.unitMinute,
        second: messages.discovery.unitSecond,
      }}
    />
  );
}
