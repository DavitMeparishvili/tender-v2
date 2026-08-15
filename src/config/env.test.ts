import { describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

const testEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL:
    "postgresql://tender_local:tender_local_only@localhost:5432/tender_dev",
  DATABASE_URL_TEST:
    "postgresql://tender_test:tender_test_local_only@localhost:5433/tender_test",
  AUTH_SECRET: "01234567890123456789012345678901",
  APP_URL: "http://localhost:3000",
  STORAGE_ENDPOINT: "http://localhost:9000",
  STORAGE_REGION: "us-east-1",
  STORAGE_BUCKET: "tender-test",
  STORAGE_ACCESS_KEY_ID: "tender_local",
  STORAGE_SECRET_ACCESS_KEY: "tender_local_only",
} satisfies NodeJS.ProcessEnv;

describe("getServerEnv", () => {
  it("rejects a missing database URL", () => {
    expect(() => getServerEnv({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it("accepts explicit test configuration", () => {
    const env = getServerEnv(testEnvironment);
    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects a missing storage bucket", () => {
    const withoutBucket: NodeJS.ProcessEnv = { ...testEnvironment };
    delete withoutBucket.STORAGE_BUCKET;
    expect(() => getServerEnv(withoutBucket)).toThrow(/STORAGE_BUCKET/);
  });

  it("lets a deployment disable path-style addressing", () => {
    expect(getServerEnv(testEnvironment).STORAGE_FORCE_PATH_STYLE).toBe(true);
    expect(
      getServerEnv({ ...testEnvironment, STORAGE_FORCE_PATH_STYLE: "false" })
        .STORAGE_FORCE_PATH_STYLE,
    ).toBe(false);
  });
});
