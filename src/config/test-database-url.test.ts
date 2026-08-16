import { describe, expect, it } from "vitest";
import {
  getTestDatabaseServerEnv,
  validateTestDatabaseUrl,
} from "./test-database-url";

const validInput = {
  NODE_ENV: "test",
  DATABASE_URL:
    "postgresql://tender_local:tender_local_only@localhost:5432/tender_dev",
  DATABASE_URL_TEST:
    "postgresql://tender_test:tender_test_local_only@localhost:5433/tender_test",
  AUTH_SECRET: "01234567890123456789012345678901",
  APP_URL: "http://localhost:3000",
  STORAGE_ENDPOINT: "http://localhost:9000",
  STORAGE_REGION: "us-east-1",
  STORAGE_BUCKET: "tender-dev",
  STORAGE_BUCKET_TEST: "tender-test",
  STORAGE_ACCESS_KEY_ID: "tender_local",
  STORAGE_SECRET_ACCESS_KEY: "tender_local_only",
  SELECTION_WORKER_SECRET: "0123456789012345678901234567890123",
  AGREEMENT_WORKER_SECRET: "0123456789012345678901234567890123",
} satisfies NodeJS.ProcessEnv;

describe("test database configuration", () => {
  it("maps a validated test URL into the server database environment", () => {
    expect(getTestDatabaseServerEnv(validInput)).toEqual({
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://tender_test:tender_test_local_only@localhost:5433/tender_test",
      DATABASE_URL_TEST:
        "postgresql://tender_test:tender_test_local_only@localhost:5433/tender_test",
      AUTH_SECRET: "01234567890123456789012345678901",
      APP_URL: "http://localhost:3000",
      STORAGE_ENDPOINT: "http://localhost:9000",
      STORAGE_REGION: "us-east-1",
      STORAGE_BUCKET: "tender-dev",
      STORAGE_BUCKET_TEST: "tender-test",
      STORAGE_ACCESS_KEY_ID: "tender_local",
      STORAGE_SECRET_ACCESS_KEY: "tender_local_only",
      STORAGE_FORCE_PATH_STYLE: true,
      SELECTION_WORKER_SECRET: "0123456789012345678901234567890123",
      AGREEMENT_WORKER_SECRET: "0123456789012345678901234567890123",
    });
  });

  it("rejects a development database URL", () => {
    expect(() =>
      validateTestDatabaseUrl(
        "postgresql://tender_local:tender_local_only@localhost:5432/tender_dev",
      ),
    ).toThrow(/ending in _test/);
  });

  it("rejects missing and malformed test database URLs", () => {
    expect(() => validateTestDatabaseUrl(undefined)).toThrow(
      /DATABASE_URL_TEST is required/,
    );
    expect(() => validateTestDatabaseUrl("not a URL")).toThrow(/valid URL/);
  });
});
