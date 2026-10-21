import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import { DiscoveryPager } from "./discovery-toolbar";
import { pagerSlots, type DiscoveryPage } from "./discovery-view";

describe("pagerSlots", () => {
  it("lists every page when there are few", () => {
    expect(pagerSlots(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pagerSlots(2, 3, true)).toEqual([1, 2, 3]);
  });

  it("collapses a long wide window to first, neighbours and last", () => {
    expect(pagerSlots(1, 10)).toEqual([1, 2, 3, 4, "gap", 10]);
    expect(pagerSlots(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pagerSlots(10, 10)).toEqual([1, "gap", 7, 8, 9, 10]);
  });

  it("keeps only first, current and last in the compact window", () => {
    expect(pagerSlots(1, 10, true)).toEqual([1, "gap", 10]);
    expect(pagerSlots(2, 10, true)).toEqual([1, 2, "gap", 10]);
    expect(pagerSlots(5, 10, true)).toEqual([1, "gap", 5, "gap", 10]);
    expect(pagerSlots(9, 10, true)).toEqual([1, "gap", 9, 10]);
    expect(pagerSlots(10, 10, true)).toEqual([1, "gap", 10]);
    expect(pagerSlots(50, 100, true)).toEqual([1, "gap", 50, "gap", 100]);
    expect(pagerSlots(2, 4, true)).toEqual([1, 2, "gap", 4]);
  });
});

function renderPager(current: number, pageCount: number) {
  const page: DiscoveryPage = {
    items: [],
    page: current,
    pageCount,
    total: pageCount * 5,
    from: (current - 1) * 5 + 1,
    to: current * 5,
  };
  return renderToStaticMarkup(
    <DiscoveryPager
      messages={en}
      page={page}
      pathname="/en/provider/tenders"
      searchParams={new URLSearchParams("pageSize=5")}
      view={{ sort: "newest", page: current, pageSize: 5 }}
    />,
  );
}

describe("DiscoveryPager", () => {
  it("renders the steps as labelled arrow links", () => {
    const html = renderPager(5, 10);
    expect(html).toContain('aria-label="Previous"');
    expect(html).toContain('aria-label="Next"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toContain('<span class="pager-step-label">Previous</span>');
    expect(html).toContain('<span class="pager-step-label">Next</span>');
  });

  it("renders the wide and compact windows with the current page marked", () => {
    const html = renderPager(5, 10);
    expect(html).toContain('class="pager-window pager-window-wide"');
    expect(html).toContain('class="pager-window pager-window-compact"');
    expect(html.match(/aria-current="page">5</g)).toHaveLength(2);
    expect(html).toContain('aria-label="Page 4"');
  });

  it("does not link a step past either end", () => {
    const first = renderPager(1, 10);
    expect(first).not.toContain('rel="prev"');
    expect(first).toContain('<span class="pager-step is-disabled">');
    const last = renderPager(10, 10);
    expect(last).not.toContain('rel="next"');
    expect(last).toContain('<span class="pager-step is-disabled">');
  });
});
