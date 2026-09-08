import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import { ActiveFilterChips } from "./discovery-toolbar";
import { parseDiscoverySearchParams } from "./discovery-query";
import { GeorgianPlaceSelect } from "./georgian-place-select";

describe("removing discovery filters", () => {
  it.each([
    [
      "specialty",
      "specialty=CONSTRUCTION_REPAIR&serviceCode=PAINTING_DECORATING&city=Tbilisi&page=3",
      ["specialty", "serviceCode"],
    ],
    [
      "currency",
      "currency=GEL&minBudget=100&maxBudget=500&city=Tbilisi&page=3",
      ["currency", "minBudget", "maxBudget"],
    ],
  ])(
    "removing %s clears dependent predicates and resets the page",
    (key, query, removed) => {
      const markup = renderToStaticMarkup(
        <ActiveFilterChips
          filters={[{ key, label: key }]}
          messages={en}
          pathname="/en/provider/tenders"
          searchParams={new URLSearchParams(query)}
        />,
      );
      const href = markup
        .match(/href="([^"]+)"/)?.[1]
        ?.replaceAll("&amp;", "&");
      expect(href).toBeDefined();
      const params = new URL(href!, "http://localhost").searchParams;
      for (const field of removed) expect(params.has(field)).toBe(false);
      expect(params.has("page")).toBe(false);
      expect(params.get("city")).toBe("Tbilisi");
      expect(parseDiscoverySearchParams(Object.fromEntries(params)).ok).toBe(
        true,
      );
    },
  );
});

describe("shared place selector", () => {
  it("combines settlements with the same search name and displays both regions", () => {
    const duplicates = [
      {
        id: 1,
        nameEn: "Akhaldaba",
        label: "Akhaldaba",
        regionLabel: "Adjara",
        secondaryLabel: "",
        latitude: 0,
        longitude: 0,
      },
      {
        id: 2,
        nameEn: "Akhaldaba",
        label: "Akhaldaba",
        regionLabel: "Samtskhe-Javakheti",
        secondaryLabel: "",
        latitude: 0,
        longitude: 0,
      },
    ];
    const html = renderToStaticMarkup(
      <GeorgianPlaceSelect
        places={duplicates}
        placeholder="All places"
        valueKey="nameEn"
        value="Akhaldaba"
        onChange={() => {}}
      />,
    );
    expect(html.match(/value="Akhaldaba"/g)).toHaveLength(1);
    expect(html).toContain("Akhaldaba · Adjara / Samtskhe-Javakheti");
  });
  const places = [
    {
      id: 1,
      nameEn: "Tbilisi",
      label: "თბილისი",
      regionLabel: "თბილისი",
      secondaryLabel: "Tbilisi",
      latitude: 41.7,
      longitude: 44.8,
    },
  ];
  it("displays localized names while submitting canonical discovery city values", () => {
    const html = renderToStaticMarkup(
      <GeorgianPlaceSelect
        places={places}
        placeholder="All places"
        valueKey="nameEn"
        value="Tbilisi"
        name="city"
        onChange={() => {}}
      />,
    );
    expect(html).toContain(
      '<option value="Tbilisi" selected="">თბილისი · თბილისი</option>',
    );
  });
  it("retains the place ID contract and a legacy fallback in tender authoring", () => {
    const html = renderToStaticMarkup(
      <GeorgianPlaceSelect
        places={places}
        placeholder="Select a place"
        value="9"
        fallbackLabel="Legacy town"
        name="placeId"
        onChange={() => {}}
      />,
    );
    expect(html).toContain(
      '<option value="9" selected="">Legacy town</option>',
    );
    expect(html).toContain('<option value="1">თბილისი · თბილისი</option>');
  });
});
