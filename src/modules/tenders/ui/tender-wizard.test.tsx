import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMessages } from "@/src/modules/localization/get-messages";
import { TenderWizard, validateWizardStep } from "./tender-wizard";

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
  });
});
