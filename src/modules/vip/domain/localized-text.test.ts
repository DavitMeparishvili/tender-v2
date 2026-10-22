import { describe, expect, it } from "vitest";
import { pickLocalizedText } from "./localized-text";

describe("pickLocalizedText", () => {
  const label = { en: "General contractor", ka: "გენერალური", ru: "Генподряд" };

  it("picks the requested locale when it has text", () => {
    expect(pickLocalizedText(label, "ka")).toBe("გენერალური");
    expect(pickLocalizedText(label, "ru")).toBe("Генподряд");
    expect(pickLocalizedText(label, "en")).toBe("General contractor");
  });

  it("falls back to English when the requested locale is missing", () => {
    expect(pickLocalizedText({ en: "Roofing" }, "ka")).toBe("Roofing");
  });

  it("falls back to English when the requested locale is blank", () => {
    expect(pickLocalizedText({ en: "Roofing", ka: "   " }, "ka")).toBe(
      "Roofing",
    );
  });

  it("trims the returned text", () => {
    expect(pickLocalizedText({ en: "  Cranes  " }, "en")).toBe("Cranes");
  });

  it("returns null when neither the locale nor English has text", () => {
    expect(pickLocalizedText({ ru: "Кран" }, "ka")).toBeNull();
    expect(pickLocalizedText({ en: "" }, "en")).toBeNull();
  });

  it("returns null for values that are not localized objects", () => {
    expect(pickLocalizedText(null, "en")).toBeNull();
    expect(pickLocalizedText(undefined, "en")).toBeNull();
    expect(pickLocalizedText("Roofing", "en")).toBeNull();
    expect(pickLocalizedText(["Roofing"], "en")).toBeNull();
    expect(pickLocalizedText({ en: 42 }, "en")).toBeNull();
  });
});
