import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import GlobalError from "../../app/global-error";

it("renders a titled bounded global recovery document", () => {
  const error = Object.assign(new Error("sensitive internal failure"), {
    digest: "correlation-123",
  });

  const html = renderToStaticMarkup(
    createElement(GlobalError, { error, reset: () => undefined }),
  );

  expect(html).toContain(
    "<title>დაფიქსირდა შეცდომა / Something went wrong</title>",
  );
  expect(html).toContain("correlation-123");
  expect(html).not.toContain("sensitive internal failure");
});
