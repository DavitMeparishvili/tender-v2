import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import {
  agreementStatus,
  clickAgreementAction,
  openPhase4Agreement,
  phase4Agreement,
  resetPhase4Fixture,
  warmUpAgreementRoutes,
} from "./fixtures/agreements";

test.beforeAll(async ({ request }) => {
  await warmUpAgreementRoutes(request);
});
test.beforeEach(async () => {
  await resetPhase4Fixture();
});
test.setTimeout(60_000);

for (const locale of ["ka", "en"] as const) {
  test(`@phase-4 participants complete the immutable agreement journey (${locale})`, async ({
    browser,
    page,
  }) => {
    const messages = messagesFor(locale);
    await signInSeededAccount(page, "providerB", locale);
    const providerAgreement = await openPhase4Agreement(
      page,
      locale,
      "PROVIDER",
    );

    expect(await agreementStatus(page, providerAgreement.id)).toBe(
      "PENDING_CONFIRMATION",
    );

    const incompleteReview = await page.request.post(
      `/api/agreements/${providerAgreement.id}/reviews`,
      {
        data: {
          quality: 5,
          deadline: 5,
          communication: 5,
          agreedPrice: 5,
          comment: "This review is deliberately attempted before completion.",
        },
      },
    );
    expect(incompleteReview.status()).toBe(409);

    await clickAgreementAction(page, messages.agreements.confirm);
    await page.goto(`/${locale}/notifications`);
    await expect(page.getByText(messages.notifications.bidWon)).toHaveCount(0);
    await expect(page.getByText(/Phase 3 tender/u)).toBeVisible();
    const markRead = page.getByRole("button", {
      name: messages.notifications.markRead,
    });
    if ((await markRead.count()) > 0) {
      await markRead.first().click();
      await expect(
        page.getByText(messages.notifications.read).first(),
      ).toBeVisible();
    }

    const clientContext = await browser.newContext();
    try {
      const clientPage = await clientContext.newPage();
      await signInSeededAccount(clientPage, "client", locale);
      const clientAgreement = await openPhase4Agreement(
        clientPage,
        locale,
        "CLIENT",
      );
      expect(clientAgreement.id).toBe(providerAgreement.id);
      await clickAgreementAction(clientPage, messages.agreements.confirm);
      await expect
        .poll(() => agreementStatus(page, providerAgreement.id))
        .toBe("AGREED");

      // Start acknowledgements deliberately happen in the opposite order.
      await clickAgreementAction(
        clientPage,
        messages.agreements.acknowledgeStart,
      );
      await page.goto(`/${locale}/agreements/${providerAgreement.id}`);
      await clickAgreementAction(page, messages.agreements.acknowledgeStart);
      await expect
        .poll(() => agreementStatus(page, providerAgreement.id))
        .toBe("IN_PROGRESS");

      // The client page was refreshed after its own acknowledgement, while
      // the provider's final acknowledgement happened in the other context.
      // Reload it so both independently rendered completion controls submit
      // at the same time against the same IN_PROGRESS snapshot.
      await clientPage.reload();
      await Promise.all([
        clickAgreementAction(clientPage, messages.agreements.confirmCompletion),
        clickAgreementAction(page, messages.agreements.confirmCompletion),
      ]);
      await expect
        .poll(() => agreementStatus(page, providerAgreement.id))
        .toBe("COMPLETED");

      await page.reload();
      await expect(
        page.getByRole("button", {
          name: messages.agreements.confirmCompletion,
        }),
      ).toHaveCount(0);
      const retry = await page.request.patch(
        `/api/agreements/${providerAgreement.id}`,
        { data: { action: "CONFIRM_COMPLETION" } },
      );
      // A terminal retry is rejected, and therefore cannot emit another
      // lifecycle event or notification.
      expect(retry.status()).toBe(409);
      await expect
        .poll(() => agreementStatus(page, providerAgreement.id))
        .toBe("COMPLETED");
    } finally {
      await clientContext.close();
    }
  });
}

test("@phase-4 an outsider cannot act on the fixed agreement", async ({
  page,
}) => {
  await signInSeededAccount(page, "provider", "en");
  const clientContext = await page.context().browser()!.newContext();
  try {
    const clientPage = await clientContext.newPage();
    await signInSeededAccount(clientPage, "client", "en");
    const agreement = await phase4Agreement(clientPage, "CLIENT");
    const response = await page.request.post(
      `/api/agreements/${agreement.id}/reviews`,
      {
        data: {
          quality: 5,
          deadline: 5,
          communication: 5,
          agreedPrice: 5,
          comment: "An outsider cannot publish a review for this agreement.",
        },
      },
    );
    expect(response.status()).toBe(403);
  } finally {
    await clientContext.close();
  }
});
