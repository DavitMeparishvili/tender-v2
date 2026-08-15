import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  formatDateInputValue,
  formatGeorgiaDateTimeLocal,
  parseDateInputValue,
  parseGeorgiaDateTimeLocal,
} from "./georgia-date-time";

describe("Georgia date and wall-time codecs", () => {
  it("round-trips Georgia wall time through an absolute deadline", () => {
    const instant = new Date("2026-08-31T12:00:00.000Z");
    const local = formatGeorgiaDateTimeLocal(instant);

    expect(local).toBe("2026-08-31T16:00");
    expect(parseGeorgiaDateTimeLocal(local)?.toISOString()).toBe(
      instant.toISOString(),
    );
  });

  it("rejects normalized or malformed calendar values", () => {
    expect(parseGeorgiaDateTimeLocal("2026-02-29T12:00")).toBeNull();
    expect(parseGeorgiaDateTimeLocal("2026-08-31T24:00")).toBeNull();
    expect(parseDateInputValue("2026-02-29")).toBeNull();
    expect(parseDateInputValue("2028-02-29")?.toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  it("formats date inputs as valid YYYY-MM-DD values", () => {
    expect(formatDateInputValue(new Date("2026-09-02T08:00:00.000Z"))).toBe(
      "2026-09-02",
    );
    expect(formatDateInputValue(null)).toBe("");
  });

  it.each(["UTC", "America/New_York"])(
    "does not vary when the process timezone is %s",
    (timezone) => {
      const source = `
        import {
          formatGeorgiaDateTimeLocal,
          parseGeorgiaDateTimeLocal,
        } from "./src/modules/tenders/ui/georgia-date-time.ts";
        const instant = new Date("2026-08-31T12:00:00.000Z");
        const local = formatGeorgiaDateTimeLocal(instant);
        process.stdout.write(JSON.stringify({
          local,
          roundTrip: parseGeorgiaDateTimeLocal(local)?.toISOString(),
        }));
      `;
      const output = execFileSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "--eval", source],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, TZ: timezone },
        },
      );

      expect(JSON.parse(output)).toEqual({
        local: "2026-08-31T16:00",
        roundTrip: "2026-08-31T12:00:00.000Z",
      });
    },
  );
});
