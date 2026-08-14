import { describe, expect, it } from "vitest";
import { getServerEnv } from "./env";

describe("getServerEnv", () => {
  it("rejects a missing database URL", () => {
    expect(() => getServerEnv({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it("accepts explicit test configuration", () => {
    const env = getServerEnv({
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://tender_local:tender_local_only@localhost:5432/tender_dev",
      DATABASE_URL_TEST:
        "postgresql://tender_test:tender_test_local_only@localhost:5433/tender_test",
      AUTH_SECRET: "01234567890123456789012345678901",
      APP_URL: "http://localhost:3000",
    });
    expect(env.NODE_ENV).toBe("test");
  });
});
