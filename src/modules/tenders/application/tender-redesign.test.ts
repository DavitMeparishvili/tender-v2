import { describe, expect, it } from "vitest";
import { updateTenderDraftCommandSchema } from "./update-tender-draft";
import { editPublishedTenderSchema } from "./edit-published-tender";
import { parseOwnedTenderQuery } from "./list-owned-tenders";
import { readWorkItems } from "../domain/work-item";
import { sniffAttachmentMimeType } from "../domain/mime-sniff";
import { canEditTender } from "../domain/edit-eligibility";

describe("structured tender fields", () => {
  it("advertises editing only while server eligibility is satisfied", () => {
    const now = new Date("2026-09-08T12:00:00Z");
    const future = new Date(now.getTime() + 1000);
    expect(canEditTender({ status: "DRAFT", deadline: null }, 0, now)).toBe(
      true,
    );
    expect(
      canEditTender({ status: "PUBLISHED", deadline: future }, 0, now),
    ).toBe(true);
    expect(
      canEditTender({ status: "PUBLISHED", deadline: future }, 1, now),
    ).toBe(false);
    expect(canEditTender({ status: "PUBLISHED", deadline: now }, 0, now)).toBe(
      false,
    );
    expect(
      canEditTender({ status: "CANCELLED", deadline: future }, 0, now),
    ).toBe(false);
  });
  const item = { name: "Floor preparation", quantity: 96, unit: "m²" };
  it("accepts decimal quantities and strips no unit information", () => {
    const result = updateTenderDraftCommandSchema.parse({
      workItems: [{ ...item, quantity: 0.25 }],
      areaSquareMeters: 96,
    });
    expect(result.workItems?.[0]).toEqual({ ...item, quantity: 0.25 });
  });
  it.each([0, -1, Infinity, NaN, 1_000_000_001])(
    "rejects invalid quantity %s",
    (quantity) => {
      expect(
        updateTenderDraftCommandSchema.safeParse({
          workItems: [{ ...item, quantity }],
        }).success,
      ).toBe(false);
    },
  );
  it("rejects payload keys that could expose attachment URLs in public quantities", () => {
    expect(
      updateTenderDraftCommandSchema.safeParse({
        workItems: [{ ...item, url: "https://private.test/file" }],
      }).success,
    ).toBe(false);
    expect(
      readWorkItems([{ ...item, url: "https://private.test/file" }]),
    ).toEqual([item]);
  });
  it("does not permit commercial or ownership changes through the published editor", () => {
    const base = {
      title: "Apartment renovation",
      fullDescription: "A complete apartment renovation project.",
      workerNotes: null,
      materialNotes: null,
      equipmentNotes: null,
      workItems: [item],
      areaSquareMeters: 96,
    };
    expect(editPublishedTenderSchema.safeParse(base).success).toBe(true);
    for (const extra of [
      { ownerId: "other" },
      { deadline: new Date() },
      { currency: "USD" },
      { budgetMinorUnits: 1 },
      { exactLatitude: 1 },
    ])
      expect(
        editPublishedTenderSchema.safeParse({ ...base, ...extra }).success,
      ).toBe(false);
  });
  it("normalizes queries to real statuses and supported ordering", () => {
    expect(
      parseOwnedTenderQuery({
        status: "COMPLETED",
        sort: "unexpected",
        search: "  Vake  ",
      }),
    ).toEqual({ search: "Vake", sort: "newest" });
    expect(
      parseOwnedTenderQuery({ status: "CLOSED", sort: "deadline" }),
    ).toEqual({ status: "CLOSED", sort: "deadline" });
  });
  it("recognizes a DWG signature without accepting a renamed short text file", () => {
    const bytes = new Uint8Array(80);
    bytes.set(new TextEncoder().encode("AC1015"));
    expect(sniffAttachmentMimeType(bytes)).toBe("image/vnd.dwg");
    expect(
      sniffAttachmentMimeType(new TextEncoder().encode("AC1015")),
    ).toBeNull();
    expect(
      sniffAttachmentMimeType(new TextEncoder().encode("not a drawing")),
    ).toBeNull();
  });
});
