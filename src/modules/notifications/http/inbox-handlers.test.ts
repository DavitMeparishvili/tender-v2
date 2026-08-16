import "dotenv/config";
import { describe, expect, it } from "vitest";
import { listInboxHandler } from "./inbox-handlers";
describe("inbox handlers", () => {
  it("requires an authenticated commercial session", async () => {
    expect((await listInboxHandler(new Request("http://x"))).status).toBe(401);
  });
});
