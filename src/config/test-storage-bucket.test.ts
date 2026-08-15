import { describe, expect, it } from "vitest";
import { validateTestStorageBucket } from "./test-storage-bucket";

describe("validateTestStorageBucket", () => {
  it("accepts a test bucket that differs from the development bucket", () => {
    expect(validateTestStorageBucket("tender-test", "tender-dev")).toBe(
      "tender-test",
    );
  });

  it("rejects a missing test bucket", () => {
    expect(() => validateTestStorageBucket(undefined, "tender-dev")).toThrow(
      /STORAGE_BUCKET_TEST is required/,
    );
  });

  it("rejects a bucket that does not name itself as a test target", () => {
    expect(() => validateTestStorageBucket("tender-dev", "tender-dev")).toThrow(
      /ending in -test/,
    );
  });

  it("rejects a test bucket that is the development bucket", () => {
    expect(() =>
      validateTestStorageBucket("tender-test", "tender-test"),
    ).toThrow(/must not name the same bucket/);
  });
});
