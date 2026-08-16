import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../../localization/get-messages";
import { ReviewForm } from "./review-form";
import { ReviewSummary } from "./review-summary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("review UI", () => {
  it("renders four labeled score controls, derived overall, and publication notice", () => {
    const copy = getMessages("en").reviews;
    const html = renderToStaticMarkup(<ReviewForm agreementId="agreement" copy={copy} />);
    expect((html.match(/<select/g) ?? [])).toHaveLength(4);
    expect(html).toContain(copy.quality);
    expect(html).toContain(copy.deadline);
    expect(html).toContain(copy.communication);
    expect(html).toContain(copy.agreedPrice);
    expect(html).toContain(copy.overall);
    expect(html).toContain(copy.publicationNotice);
    expect(html).not.toContain('name="overall"');
  });

  it("uses a clear zero-review state instead of a rating", () => {
    const copy = getMessages("ka").reviews;
    const html = renderToStaticMarkup(
      <ReviewSummary
        copy={copy}
        aggregate={{ reviewCount: 0, overall: null, quality: null, deadline: null, communication: null, agreedPrice: null }}
      />,
    );
    expect(html).toContain(copy.empty);
    expect(html).not.toContain("0.00");
  });
});
