import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

describe("proxy", () => {
  it("optimistically redirects a workspace request without a session cookie", () => {
    const response = proxy(new NextRequest("http://localhost/en/client"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en/login");
  });

  it("allows a workspace request with a session cookie to continue", () => {
    const response = proxy(
      new NextRequest("http://localhost/ka/provider", {
        headers: { cookie: "better-auth.session_token=optimistic-only" },
      }),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
