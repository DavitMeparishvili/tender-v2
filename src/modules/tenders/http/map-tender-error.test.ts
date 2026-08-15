import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import ka from "../../localization/messages/ka.json";
import {
  TENDER_ERROR_MESSAGE_KEYS,
  mapTenderError,
  type TenderErrorCode,
} from "./map-tender-error";

function resolve(catalog: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (value, segment) =>
        typeof value === "object" && value !== null
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      catalog,
    );
}

const codes = Object.keys(TENDER_ERROR_MESSAGE_KEYS) as TenderErrorCode[];

describe("mapTenderError", () => {
  // The catalogs are the only source of truth for a message; a key that does
  // not resolve leaves the client with nothing to render. Both locales are
  // checked because `messages.test.ts` guarantees they stay key-for-key
  // identical only against each other, not against this map.
  it.each(codes)(
    "emits a %s message key that exists in both catalogs",
    (code) => {
      const messageKey = TENDER_ERROR_MESSAGE_KEYS[code];
      expect(typeof resolve(en, messageKey)).toBe("string");
      expect(typeof resolve(ka, messageKey)).toBe("string");
    },
  );

  it("never emits a key under the non-existent `tenders.errors.<CODE>` namespace", async () => {
    for (const code of codes) {
      const body = (await mapTenderError(code).json()) as {
        code: string;
        messageKey: string;
      };
      expect(body.code).toBe(code);
      expect(body.messageKey).toBe(TENDER_ERROR_MESSAGE_KEYS[code]);
      expect(body.messageKey).not.toBe(`tenders.errors.${code}`);
    }
  });

  it("keeps the status mapping for the codes handlers rely on", async () => {
    expect(mapTenderError("UNAUTHENTICATED").status).toBe(401);
    expect(mapTenderError("NOT_OWNER").status).toBe(403);
    expect(mapTenderError("TENDER_NOT_FOUND").status).toBe(404);
    expect(mapTenderError("NOT_FOUND").status).toBe(404);
    expect(mapTenderError("INVALID_INPUT").status).toBe(400);
    expect(mapTenderError("NOT_DRAFT").status).toBe(409);
    expect(mapTenderError("ALREADY_CANCELLED").status).toBe(409);
    expect(mapTenderError("FILE_TOO_LARGE").status).toBe(413);
    expect(mapTenderError("UNSUPPORTED_FILE_TYPE").status).toBe(422);
    expect(mapTenderError("ADDRESS_NOT_FOUND").status).toBe(422);
    expect(mapTenderError("COORDINATES_NOT_FOUND").status).toBe(422);
    // Every publication blocker stays a 400: the draft is simply incomplete.
    expect(mapTenderError("DEADLINE_NOT_FUTURE").status).toBe(400);
    expect(mapTenderError("LOCATION_REQUIRED").status).toBe(400);
  });
});
