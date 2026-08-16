"use client";

import { useEffect, useState } from "react";
import { formatCountdown, type CountdownUnits } from "./countdown-format";

/**
 * Server-rendered markup carries the absolute deadline in a `<time>`, which is
 * both pure to render and the more useful value without JavaScript. The
 * relative counter takes over after mount and ticks once per second; a passed
 * deadline renders the closed label and never starts a timer.
 */
export function Countdown({
  absoluteLabel,
  closedLabel,
  deadline,
  template,
  units,
}: Readonly<{
  absoluteLabel: string;
  closedLabel: string;
  deadline: string;
  template: string;
  units: CountdownUnits;
}>) {
  const [remaining, setRemaining] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  // Depend on the unit strings, not the object: a server-rendered prop object
  // is a fresh reference on every parent render and would restart the timer.
  const { day, hour, minute, second } = units;

  useEffect(() => {
    const tick = () => {
      const parts = formatCountdown(deadline, Date.now(), {
        day,
        hour,
        minute,
        second,
      });
      setExpired(parts.expired);
      setRemaining(parts.expired ? null : parts.text);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [day, deadline, hour, minute, second]);

  return (
    <span className="countdown">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        aria-hidden="true"
        height={13}
        src="/icons/clock.png"
        width={13}
      />
      {expired ? (
        closedLabel
      ) : remaining === null ? (
        <time dateTime={deadline}>{absoluteLabel}</time>
      ) : (
        template.replace("{time}", remaining)
      )}
    </span>
  );
}
