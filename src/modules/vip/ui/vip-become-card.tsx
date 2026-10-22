import type { Messages } from "../../localization/get-messages";

/**
 * The "Become a VIP partner" card. It is always the last grid item. Its button
 * is a mailto link, because no application flow exists yet.
 */
export function VipBecomeCard({
  contactHref,
  messages,
}: Readonly<{
  contactHref: string;
  messages: Messages;
}>) {
  const copy = messages.vip;

  return (
    <li className="vip-become-card">
      <span className="vip-become-title">{copy.become}</span>
      <span className="vip-become-body">{copy.becomeBody}</span>
      <a className="vip-become-apply" href={contactHref}>
        {copy.apply}
      </a>
    </li>
  );
}
