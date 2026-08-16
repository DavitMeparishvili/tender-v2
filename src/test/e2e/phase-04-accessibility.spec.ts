import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import {
  agreementStatus,
  keyboardAgreementAction,
  openPhase4Agreement,
  resetPhase4Fixture,
  warmUpAgreementRoutes,
} from "./fixtures/agreements";

test.beforeAll(async ({ request }) => {
  await warmUpAgreementRoutes(request);
});
test.beforeEach(async () => {
  await resetPhase4Fixture();
});
test.setTimeout(90_000);

for (const locale of ["ka", "en"] as const) {
  test(`@phase-4 agreement and inbox keep the workspace accessible (${locale})`, async ({
    browser,
    page,
  }) => {
    const messages = messagesFor(locale);
    await signInSeededAccount(page, "providerB", locale);
    const agreement = await openPhase4Agreement(page, locale, "PROVIDER");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await keyboardAgreementAction(page, messages.agreements.confirm);

    const clientContext = await browser.newContext();
    try {
      const clientPage = await clientContext.newPage();
      await signInSeededAccount(clientPage, "client", locale);
      await openPhase4Agreement(clientPage, locale, "CLIENT");
      await keyboardAgreementAction(clientPage, messages.agreements.confirm);
      await keyboardAgreementAction(
        clientPage,
        messages.agreements.acknowledgeStart,
      );
      await page.goto(`/${locale}/agreements/${agreement.id}`);
      await keyboardAgreementAction(page, messages.agreements.acknowledgeStart);
      await clientPage.reload();
      await Promise.all([
        keyboardAgreementAction(
          clientPage,
          messages.agreements.confirmCompletion,
        ),
        keyboardAgreementAction(page, messages.agreements.confirmCompletion),
      ]);
      await expect
        .poll(() => agreementStatus(page, agreement.id))
        .toBe("COMPLETED");
    } finally {
      await clientContext.close();
    }

    await page.reload();
    const controls = page.locator("select, textarea");
    await expect(controls).toHaveCount(5);
    expect(
      await controls.evaluateAll((elements) =>
        elements.every(
          (element) =>
            (element instanceof HTMLSelectElement ||
              element instanceof HTMLTextAreaElement) &&
            element.labels?.length === 1,
        ),
      ),
    ).toBe(true);
    const comment = page.getByLabel(messages.reviews.comment);
    await comment.fill("words words words words words words words words");
    const invalidSubmit = page.getByRole("button", {
      name: messages.reviews.publish,
    });
    await invalidSubmit.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toBeVisible();
    await comment.fill(
      "The work was organised carefully, communication stayed clear, and the agreed scope was completed reliably.",
    );
    const reviewResponse = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        candidate.url().includes("/reviews") &&
        candidate.request().postData()?.includes("agreed scope") === true,
    );
    await invalidSubmit.focus();
    await page.keyboard.press("Enter");
    expect((await reviewResponse).status()).toBe(201);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);

    const agreementText = (
      await page.locator("main").innerText()
    ).toLocaleLowerCase();
    await page.goto(`/${locale}/notifications`);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: messages.notifications.title }),
    ).toBeVisible();
    const inboxText = (
      await page.locator("main").innerText()
    ).toLocaleLowerCase();
    expect(`${agreementText}\n${inboxText}`).not.toMatch(
      /resolve dispute|decide fault|guarantee payment|award compensation/u,
    );
  });
}
