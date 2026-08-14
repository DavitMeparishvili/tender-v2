import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import LocaleLayout from "../../app/[locale]/layout";
import ErrorPage from "../../app/error";
import GlobalError from "../../app/global-error";
import GlobalNotFound from "../../app/global-not-found";
import NotFound from "../../app/not-found";

function expectTaggedFragments(
  html: string,
  fragments: ReadonlyArray<readonly [georgian: string, english: string]>,
) {
  for (const [georgian, english] of fragments) {
    expect(html).toContain(`<span lang="ka">${georgian}</span>`);
    expect(html).toContain(`<span lang="en">${english}</span>`);
  }
}

async function renderInEnglishDocument(child: ReactElement): Promise<string> {
  const document = await LocaleLayout({
    children: child,
    params: Promise.resolve({ locale: "en" }),
  });

  return renderToStaticMarkup(document);
}

it("marks both languages in the English segment recovery document", async () => {
  const error = Object.assign(new Error("private database detail"), {
    digest: "correlation-456",
  });
  const html = await renderInEnglishDocument(
    createElement(ErrorPage, { error, reset: () => undefined }),
  );

  expect(html).toContain('<html lang="en">');
  expectTaggedFragments(html, [
    ["დაფიქსირდა შეცდომა.", "Something went wrong."],
    ["გთხოვთ, ხელახლა სცადოთ.", "Please try again."],
    ["მითითება", "Reference"],
    ["ხელახლა ცდა", "Try again"],
  ]);
  expect(html).toContain("correlation-456");
  expect(html).not.toContain("private database detail");
});

it("marks both languages in the English segment not-found document", async () => {
  const html = await renderInEnglishDocument(createElement(NotFound));

  expect(html).toContain('<html lang="en">');
  expectTaggedFragments(html, [
    ["გვერდი ვერ მოიძებნა.", "Page not found."],
    [
      "შეამოწმეთ მისამართი ან დაბრუნდით მთავარ გვერდზე.",
      "Check the address or return to the home page.",
    ],
    ["მთავარ გვერდზე დაბრუნება", "Return to the home page"],
  ]);
});

it("marks both languages in standalone root recovery documents", () => {
  const error = Object.assign(new Error("private root failure"), {
    digest: "correlation-789",
  });
  const errorHtml = renderToStaticMarkup(
    createElement(GlobalError, { error, reset: () => undefined }),
  );
  const notFoundHtml = renderToStaticMarkup(createElement(GlobalNotFound));

  expect(errorHtml).toContain('<html lang="ka">');
  expectTaggedFragments(errorHtml, [
    ["დაფიქსირდა შეცდომა.", "Something went wrong."],
    ["გთხოვთ, ხელახლა სცადოთ.", "Please try again."],
    ["მითითება", "Reference"],
    ["ხელახლა ცდა", "Try again"],
  ]);
  expect(errorHtml).not.toContain("private root failure");

  expect(notFoundHtml).toContain('<html lang="ka">');
  expectTaggedFragments(notFoundHtml, [
    ["გვერდი ვერ მოიძებნა.", "Page not found."],
    [
      "შეამოწმეთ მისამართი ან დაბრუნდით მთავარ გვერდზე.",
      "Check the address or return to the home page.",
    ],
    ["მთავარ გვერდზე დაბრუნება", "Return to the home page"],
  ]);
});
