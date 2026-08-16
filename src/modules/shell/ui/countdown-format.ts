const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type CountdownUnits = Readonly<{
  day: string;
  hour: string;
  minute: string;
  second: string;
}>;

export const DEFAULT_COUNTDOWN_UNITS: CountdownUnits = {
  day: "d",
  hour: "h",
  minute: "m",
  second: "s",
};

export type CountdownParts =
  Readonly<{ expired: true }> | Readonly<{ expired: false; text: string }>;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * Deadline counters read `Nd Nh` above a day, `Nh NNm` above an hour, and
 * `Nm NNs` below it. Unit suffixes are passed in so a Georgian page reads
 * Georgian units rather than Latin abbreviations. A passed deadline has no
 * remainder to render — the caller switches the tender to its closed
 * presentation instead of showing 0m 00s.
 */
export function formatCountdown(
  deadline: Date | string,
  now: Date | number,
  units: CountdownUnits = DEFAULT_COUNTDOWN_UNITS,
): CountdownParts {
  const target =
    typeof deadline === "string"
      ? new Date(deadline).valueOf()
      : deadline.valueOf();
  const current = typeof now === "number" ? now : now.valueOf();

  if (Number.isNaN(target)) return { expired: true };

  const remaining = target - current;
  if (remaining <= 0) return { expired: true };

  if (remaining >= DAY) {
    const days = Math.floor(remaining / DAY);
    const hours = Math.floor((remaining % DAY) / HOUR);
    return {
      expired: false,
      text: `${days}${units.day} ${hours}${units.hour}`,
    };
  }

  if (remaining >= HOUR) {
    const hours = Math.floor(remaining / HOUR);
    const minutes = Math.floor((remaining % HOUR) / MINUTE);
    return {
      expired: false,
      text: `${hours}${units.hour} ${pad(minutes)}${units.minute}`,
    };
  }

  const minutes = Math.floor(remaining / MINUTE);
  const seconds = Math.floor((remaining % MINUTE) / SECOND);
  return {
    expired: false,
    text: `${minutes}${units.minute} ${pad(seconds)}${units.second}`,
  };
}
