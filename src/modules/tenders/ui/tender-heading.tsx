import type { ReactNode } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { TenderCurrency } from "../domain/tender";
import { TenderIcon, type TenderIconName } from "./tender-icon";
import { tenderPageCopy } from "./tender-page-copy";
import { georgianDateLabel } from "./georgian-calendar-labels";
import { formatGeorgiaDateTimeLocal } from "./georgia-date-time";
import { VipBadge } from "../../vip/ui/vip-badge";
import { formatTenderMoney } from "./tender-format";
export function tenderDate(
  value: Date | string | null,
  locale: Locale,
  time = false,
) {
  if (!value) return "—";
  const date = new Date(value);
  if (locale === "ka") {
    const local = formatGeorgiaDateTimeLocal(date);
    return `${georgianDateLabel(local)}${time ? ` · ${local.slice(11, 16)}` : ""}`;
  }
  const day = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Tbilisi",
  }).format(date);
  return time
    ? `${day} · ${new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tbilisi" }).format(date)}`
    : day;
}
export function tenderMoney(
  value: number | null,
  currency: TenderCurrency | null,
  locale: Locale,
) {
  return formatTenderMoney(value, currency, locale) ?? "—";
}

export function TenderMoney({
  value,
  currency,
  locale,
}: {
  value: number | null;
  currency: TenderCurrency | null;
  locale: Locale;
}) {
  const formatted = formatTenderMoney(value, currency, locale);
  if (formatted === null) return <>—</>;
  const amount = formatted.split("\u00a0")[0];
  return (
    <span className="tender-money">
      <span>{amount}</span>{" "}
      <span className="tender-money-currency">{currency}</span>
    </span>
  );
}
export function TenderFact({
  icon,
  label,
  children,
  className = "",
}: {
  icon: TenderIconName;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tender-fact ${className}`}>
      <TenderIcon name={icon} />
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
export function TenderHeading({
  title,
  category,
  service,
  status,
  owner = false,
  ownerIsVip = false,
  city,
  budget,
  currency,
  deadline,
  start,
  publishedAt,
  reference,
  id,
  locale,
  messages,
  actions,
}: {
  title: string;
  category: string;
  service: string;
  status: string;
  owner?: boolean;
  ownerIsVip?: boolean;
  city: string;
  budget: number | null;
  currency: TenderCurrency | null;
  deadline: Date | string | null;
  start: Date | string | null;
  publishedAt: Date | string | null;
  reference?: string | null;
  id: string;
  locale: Locale;
  messages: Messages;
  actions?: ReactNode;
}) {
  const c = tenderPageCopy(locale);
  return (
    <header className="tender-heading">
      <div className="tender-title-row">
        <div>
          <div className="tender-badges">
            <span className="tender-badge category">{category}</span>
            <span className="tender-badge">{status}</span>
            {owner ? (
              <span className="tender-badge neutral">{c.yourTender}</span>
            ) : null}
            {ownerIsVip ? <VipBadge label={messages.vip.badgeLabel} /> : null}
          </div>
          <h1>{title}</h1>
          <p className="tender-heading-location">
            <TenderIcon name="pin" size={18} />
            <span>
              {city}
              <span className="desktop-label"> · {service}</span>
            </span>
          </p>
          <p className="tender-published">
            {messages.tenders.publishedAt} {tenderDate(publishedAt, locale)} ·{" "}
            {c.reference} {reference ?? id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        {actions ? (
          <div className="tender-heading-actions">{actions}</div>
        ) : null}
      </div>
      <dl className="tender-facts">
        <TenderFact icon="wallet" label={messages.tenders.budget}>
          <TenderMoney value={budget} currency={currency} locale={locale} />
        </TenderFact>
        <TenderFact icon="calendar" label={messages.tenders.deadline}>
          {tenderDate(deadline, locale, true)}
        </TenderFact>
        <TenderFact icon="calendar" label={messages.tenders.desiredStartDate}>
          {tenderDate(start, locale)}
        </TenderFact>
        <TenderFact icon="pin" label={c.location}>
          {city}
        </TenderFact>
      </dl>
    </header>
  );
}
