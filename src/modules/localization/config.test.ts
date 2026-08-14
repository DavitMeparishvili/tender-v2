import { expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale } from "./config";

it("accepts only supported locales", () => {
  expect(DEFAULT_LOCALE).toBe("ka");
  expect(isLocale("ka")).toBe(true);
  expect(isLocale("en")).toBe(true);
  expect(isLocale("ru")).toBe(false);
});
