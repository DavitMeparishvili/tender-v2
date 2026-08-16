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

  it("still redirects a session-less request to the provider dashboard root", () => {
    const response = proxy(new NextRequest("http://localhost/en/provider"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/en/login");
  });

  it("lets a session-less visitor browse the public tender discovery list", () => {
    const response = proxy(
      new NextRequest("http://localhost/en/provider/tenders"),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets a session-less visitor read a public tender detail page", () => {
    const response = proxy(
      new NextRequest("http://localhost/en/provider/tenders/tender-1"),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
