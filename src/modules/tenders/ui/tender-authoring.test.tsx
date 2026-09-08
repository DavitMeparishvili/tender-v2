import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TenderAuthoring, authoringDetails } from "./tender-authoring";
import { getMessages } from "../../localization/get-messages";
import { authoringSchema } from "../application/save-tender-authoring";
import { toLocationCommand } from "./tender-wizard";
import { tenderDate, tenderMoney } from "./tender-heading";
import { DateField } from "./date-field";
import { datePickerCopy } from "./tender-action-copy";

describe("tender authoring contract", () => {
  it("renders deterministic Georgian dates across server and browser ICU versions", () => {
    expect(tenderMoney(4800000, "GEL", "ka")).toBe("GEL 48\u00a0000");
    expect(tenderMoney(123456, "GEL", "ka")).toBe("GEL 1234,56");
    expect(tenderDate("2026-09-24T21:30:00Z", "ka", true)).toBe(
      "25 სექტემბერი, 2026 · 01:30",
    );
    const html = renderToStaticMarkup(
      <DateField
        name="start"
        value="2026-10-05"
        locale="ka"
        copy={datePickerCopy(getMessages("ka"))}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain("5 ოქტომბერი, 2026");
  });
  it("serializes explicit draft clearing and preserves independent legacy text", () => {
    const cleared = authoringDetails({
      specialty: "CONSTRUCTION_REPAIR",
      serviceCode: "RENOVATION_REMODELING",
      title: "Renovation in Vake",
      fullDescription: "",
      budget: "",
      deadline: "",
      areaSquareMeters: "",
    });
    expect(cleared).toMatchObject({
      fullDescription: null,
      shortDescription: null,
      scopeOfWork: null,
      budgetMinorUnits: null,
      deadline: null,
      areaSquareMeters: null,
    });
    expect(
      authoringSchema.safeParse({
        details: cleared,
        location: null,
        retainedAttachmentIds: [],
        uploads: [],
      }).success,
    ).toBe(true);
    const updated = authoringDetails({
      fullDescription: "Updated description for renovation work",
      shortDescription: "Independent existing summary",
      scopeOfWork: "Independent existing scope",
      budget: "48000",
      deadline: "2026-09-25T12:00",
    });
    expect(updated.shortDescription).toBe("Independent existing summary");
    expect(updated.scopeOfWork).toBe("Independent existing scope");
    expect(updated.budgetMinorUnits).toBe(4_800_000);
    expect(updated.deadline?.toISOString()).toBe("2026-09-25T08:00:00.000Z");
  });
  it("keeps the street address when its map pin is adjusted", () => {
    expect(
      toLocationCommand({
        locationMode: "PIN",
        city: "Tbilisi",
        addressLine: "Chavchavadze Avenue 37",
        latitude: "41.711529",
        longitude: "44.757378",
      }),
    ).toMatchObject({
      mode: "PIN",
      addressLine: "Chavchavadze Avenue 37",
      latitude: 41.711529,
      longitude: 44.757378,
    });
  });
  it("renders five sections and a single correctly labelled area input", () => {
    const html = renderToStaticMarkup(
      <TenderAuthoring locale="en" messages={getMessages("en")} places={[]} />,
    );
    expect(html.match(/id="areaSquareMeters"/g)).toHaveLength(1);
    expect(html).toContain('aria-describedby="areaSquareMeters-description"');
    for (const id of [
      "project",
      "work",
      "budget-dates",
      "files",
      "project-location",
    ])
      expect(html).toContain(`id="${id}"`);
  });
});
