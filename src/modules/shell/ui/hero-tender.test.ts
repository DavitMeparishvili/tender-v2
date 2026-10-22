import { describe, expect, it } from "vitest";
import type { PublicTenderSummary } from "../../tenders/domain/masking";
import { pickHeroTender } from "./hero-tender";

function tender(id: string, publishedAt: string, ownerIsVip = false) {
  return {
    id,
    publishedAt,
    ownerIsVip,
  } as PublicTenderSummary;
}

describe("pickHeroTender", () => {
  it("picks the newest published tender even when a VIP tender is listed first", () => {
    const tenders = [
      tender("vip-old", "2026-06-01T00:00:00.000Z", true),
      tender("std-new", "2026-06-09T00:00:00.000Z"),
      tender("std-mid", "2026-06-05T00:00:00.000Z"),
    ];
    expect(pickHeroTender(tenders)?.id).toBe("std-new");
  });

  it("breaks a publication-time tie by id", () => {
    const at = "2026-06-05T00:00:00.000Z";
    expect(
      pickHeroTender([tender("b", at), tender("a", at), tender("c", at)])?.id,
    ).toBe("a");
  });

  it("returns undefined when there are no tenders", () => {
    expect(pickHeroTender([])).toBeUndefined();
  });
});
