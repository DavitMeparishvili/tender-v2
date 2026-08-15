import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMessages } from "@/src/modules/localization/get-messages";
import {
  TenderWizard,
  majorUnitsToMinor,
  shouldGuardWizardLink,
  toUpdateCommand,
  validateWizardStep,
  wizardHasUnsavedWork,
} from "./tender-wizard";

const messages = getMessages("en");

describe("validateWizardStep", () => {
  it("blocks the basics step without a title", () => {
    expect(validateWizardStep(0, { title: "" }, messages)).toEqual([
      { field: "title", message: messages.errors.required },
    ]);
  });

  it("allows the basics step once a title is present", () => {
    expect(
      validateWizardStep(0, { title: "Repaint two bedrooms" }, messages),
    ).toEqual([]);
  });

  it("mirrors the server minimum lengths for basics and scope", () => {
    expect(validateWizardStep(0, { title: "Four" }, messages)).toEqual([
      { field: "title", message: messages.tenders.errors.invalidInput },
    ]);

    expect(
      validateWizardStep(
        1,
        {
          shortDescription: "123456789",
          fullDescription: "1234567890123456789",
          scopeOfWork: "123456789",
          budget: "800.00",
          currency: "GEL",
          deadline: "2999-01-01T12:00",
        },
        messages,
      ),
    ).toEqual([
      {
        field: "shortDescription",
        message: messages.tenders.errors.invalidInput,
      },
      {
        field: "fullDescription",
        message: messages.tenders.errors.invalidInput,
      },
      {
        field: "scopeOfWork",
        message: messages.tenders.errors.invalidInput,
      },
    ]);
  });

  it("mirrors the server minimum lengths for address locations", () => {
    expect(
      validateWizardStep(
        2,
        { city: "T", addressLine: "12", locationMode: "ADDRESS" },
        messages,
      ),
    ).toEqual([
      { field: "city", message: messages.tenders.errors.invalidInput },
      {
        field: "addressLine",
        message: messages.tenders.errors.invalidInput,
      },
    ]);
  });

  it("allows scope and address values at the server boundaries", () => {
    expect(
      validateWizardStep(
        1,
        {
          shortDescription: "1234567890",
          fullDescription: "12345678901234567890",
          scopeOfWork: "1234567890",
          budget: "0.01",
          currency: "USD",
          deadline: "2999-01-01T12:00",
        },
        messages,
      ),
    ).toEqual([]);
    expect(
      validateWizardStep(
        2,
        { city: "GE", addressLine: "123", locationMode: "ADDRESS" },
        messages,
      ),
    ).toEqual([]);
  });

  it("rejects a malformed optional desired start date", () => {
    expect(
      validateWizardStep(
        1,
        {
          shortDescription: "1234567890",
          fullDescription: "12345678901234567890",
          scopeOfWork: "1234567890",
          budget: "100.00",
          currency: "GEL",
          deadline: "2999-01-01T12:00",
          desiredStartDate: "2026-02-29",
        },
        messages,
      ),
    ).toContainEqual({
      field: "desiredStartDate",
      message: messages.tenders.errors.invalidInput,
    });
  });
});

describe("majorUnitsToMinor", () => {
  it("converts decimal major units without floating-point rounding", () => {
    expect(majorUnitsToMinor("800")).toBe(80_000);
    expect(majorUnitsToMinor("0.1")).toBe(10);
    expect(majorUnitsToMinor("21474836.47")).toBe(2_147_483_647);
  });

  it("rejects excess precision and values outside a Prisma Int", () => {
    expect(majorUnitsToMinor("1.005")).toBeNull();
    expect(majorUnitsToMinor("21474836.48")).toBeNull();
    expect(majorUnitsToMinor("1e2")).toBeNull();
    expect(majorUnitsToMinor("999999999999999999999999")).toBeNull();
    expect(majorUnitsToMinor("0")).toBeNull();
  });
});

describe("toUpdateCommand", () => {
  const complete = {
    shortDescription: "Prepare and repaint two rooms.",
    fullDescription:
      "Protect the floors, prepare the walls, and apply two coats.",
    scopeOfWork: "Two bedrooms with minor wall repairs.",
    budget: "1234.56",
    currency: "GEL" as const,
    deadline: "2026-08-31T16:00",
    workerNotes: "",
    equipmentNotes: "",
    materialNotes: "",
    conditions: "",
  };

  it("serializes Georgia wall time without consulting the host timezone", () => {
    expect(toUpdateCommand(complete)).toMatchObject({
      budgetMinorUnits: 123_456,
      deadline: new Date("2026-08-31T12:00:00.000Z"),
    });
  });

  it("sends an explicit null when the desired date is cleared", () => {
    expect(
      toUpdateCommand({ ...complete, desiredStartDate: "" }),
    ).toMatchObject({
      desiredStartDate: null,
      workerNotes: null,
      equipmentNotes: null,
      materialNotes: null,
      conditions: null,
    });
  });

  it("serializes a valid desired date as its date-only UTC value", () => {
    expect(
      toUpdateCommand({ ...complete, desiredStartDate: "2026-09-02" }),
    ).toMatchObject({
      desiredStartDate: new Date("2026-09-02T00:00:00.000Z"),
    });
  });
});

describe("wizardHasUnsavedWork", () => {
  it("protects both local edits and a created draft", () => {
    expect(wizardHasUnsavedWork(null, false)).toBe(false);
    expect(wizardHasUnsavedWork(null, true)).toBe(true);
    expect(wizardHasUnsavedWork("tender-1", false)).toBe(true);
  });
});

describe("shouldGuardWizardLink", () => {
  const current =
    "https://tender.test/en/client/tenders/new?source=workspace#form-errors";

  it("exempts same-document error and skip-link fragments", () => {
    expect(shouldGuardWizardLink(current, "#title")).toBe(false);
    expect(shouldGuardWizardLink(current, "#main-content")).toBe(false);
  });

  it("guards links that change the path, query, or origin", () => {
    expect(shouldGuardWizardLink(current, "/en/client")).toBe(true);
    expect(
      shouldGuardWizardLink(
        current,
        "/en/client/tenders/new?source=header#title",
      ),
    ).toBe(true);
    expect(shouldGuardWizardLink(current, "https://example.com/#title")).toBe(
      true,
    );
  });
});

describe("TenderWizard", () => {
  it("renders a four-step rail with the first step current", () => {
    const html = renderToStaticMarkup(
      <TenderWizard locale="en" messages={messages} />,
    );

    expect(html).toContain("wizard-rail");
    expect(html).toContain(messages.tenders.wizardBasicsStep);
    expect(html).toContain(messages.tenders.wizardReviewStep);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('id="wizard-step-1-heading"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-labelledby="wizard-step-1-heading"');
    expect(html).toContain('data-dirty="false"');
  });

  it("resumes an owned draft without changing the create defaults", () => {
    const html = renderToStaticMarkup(
      <TenderWizard
        locale="en"
        messages={messages}
        initialTenderId="tender-1"
        initialForm={{ title: "Resume this draft", currency: "USD" }}
      />,
    );

    expect(html).toContain('value="Resume this draft"');
    expect(html).toContain('data-dirty="true"');
  });
});
