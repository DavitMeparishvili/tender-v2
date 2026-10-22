import { describe, expect, it } from "vitest";
import { fillTemplate, pluralTemplate, type PluralForms } from "./plural-forms";

const russian: PluralForms = {
  one: "{count} партнёр",
  few: "{count} партнёра",
  many: "{count} партнёров",
  other: "{count} партнёров",
};

const english: PluralForms = {
  one: "{count} partner",
  other: "{count} partners",
};

describe("pluralTemplate", () => {
  it("picks the English singular only for exactly one", () => {
    expect(pluralTemplate(english, 1, "en")).toBe("{count} partner");
    expect(pluralTemplate(english, 0, "en")).toBe("{count} partners");
    expect(pluralTemplate(english, 2, "en")).toBe("{count} partners");
  });

  it("uses the three Russian forms by last digit and teen rule", () => {
    const formFor = (count: number) => pluralTemplate(russian, count, "ru");

    expect(formFor(1)).toBe("{count} партнёр");
    expect(formFor(21)).toBe("{count} партнёр");
    expect(formFor(2)).toBe("{count} партнёра");
    expect(formFor(4)).toBe("{count} партнёра");
    expect(formFor(22)).toBe("{count} партнёра");
    expect(formFor(0)).toBe("{count} партнёров");
    expect(formFor(5)).toBe("{count} партнёров");
    expect(formFor(11)).toBe("{count} партнёров");
    expect(formFor(14)).toBe("{count} партнёров");
  });

  it("falls back to the other form for a missing category", () => {
    expect(pluralTemplate(english, 3, "ru")).toBe("{count} partners");
  });

  it("uses the single form for Georgian, which has no count-dependent noun form", () => {
    const georgian: PluralForms = { other: "{count} პარტნიორი" };
    for (const count of [1, 2, 5, 21]) {
      expect(pluralTemplate(georgian, count, "ka")).toBe("{count} პარტნიორი");
    }
  });
});

describe("fillTemplate", () => {
  it("replaces every occurrence of each named placeholder", () => {
    expect(fillTemplate("Showing 1–{n} of {n} partners", { n: 8 })).toBe(
      "Showing 1–8 of 8 partners",
    );
  });

  it("leaves unknown placeholders in place", () => {
    expect(fillTemplate("{count} in {category}", { count: 3 })).toBe(
      "3 in {category}",
    );
  });
});
