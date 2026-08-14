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
