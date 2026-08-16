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

const substantiveComment =
  "The work was organised carefully, communication stayed clear, and the agreed scope was completed reliably.";

async function publishFromPage(
  page: import("@playwright/test").Page,
  locale: "ka" | "en",
) {
  const messages = messagesFor(locale);
  for (const [label, value] of [
    [messages.reviews.quality, "5"],
    [messages.reviews.deadline, "4"],
    [messages.reviews.communication, "5"],
    [messages.reviews.agreedPrice, "4"],
  ] as const) {
    await page.getByLabel(label).selectOption(value);
  }
  await page.getByLabel(messages.reviews.comment).fill(substantiveComment);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      candidate.url().includes("/reviews"),
  );
  await page.getByRole("button", { name: messages.reviews.publish }).click();
  expect((await response).status()).toBe(201);
}

async function completeAgreementForReview(
  browser: import("@playwright/test").Browser,
  providerPage: import("@playwright/test").Page,
  locale: "ka" | "en",
  agreementId: string,
) {
  const messages = messagesFor(locale);
  const clientContext = await browser.newContext();
  try {
    const clientPage = await clientContext.newPage();
    await signInSeededAccount(clientPage, "client", locale);
    await openPhase4Agreement(clientPage, locale, "CLIENT");
    await clickAgreementAction(providerPage, messages.agreements.confirm);
    await clickAgreementAction(clientPage, messages.agreements.confirm);
    await clickAgreementAction(
      clientPage,
      messages.agreements.acknowledgeStart,
    );
    await providerPage.goto(`/${locale}/agreements/${agreementId}`);
    await clickAgreementAction(
      providerPage,
      messages.agreements.acknowledgeStart,
    );
    await clientPage.reload();
    await Promise.all([
      clickAgreementAction(clientPage, messages.agreements.confirmCompletion),
      clickAgreementAction(providerPage, messages.agreements.confirmCompletion),
    ]);
    await expect
      .poll(() => agreementStatus(providerPage, agreementId))
      .toBe("COMPLETED");
    await providerPage.reload();
  } finally {
    await clientContext.close();
  }
}

for (const locale of ["ka", "en"] as const) {
  test(`@phase-4 reciprocal reviews and redaction remain public-safe (${locale})`, async ({
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
    await completeAgreementForReview(
      browser,
      page,
      locale,
      providerAgreement.id,
    );
    await publishFromPage(page, locale);
    await expect(
      page.getByRole("button", { name: messages.reviews.publish }),
    ).toHaveCount(0);

    const clientContext = await browser.newContext();
    try {
      const clientPage = await clientContext.newPage();
      await signInSeededAccount(clientPage, "client", locale);
      const clientAgreement = await openPhase4Agreement(
        clientPage,
        locale,
        "CLIENT",
      );
      await publishFromPage(clientPage, locale);
      await expect(
        clientPage.getByRole("button", { name: messages.reviews.publish }),
      ).toHaveCount(0);

      const duplicate = await clientPage.request.post(
        `/api/agreements/${clientAgreement.id}/reviews`,
        {
          data: {
            quality: 5,
            deadline: 5,
            communication: 5,
            agreedPrice: 5,
            comment: substantiveComment,
          },
        },
      );
      expect(duplicate.status()).toBe(409);
      const selfShaped = await clientPage.request.post(
        `/api/agreements/${clientAgreement.id}/reviews`,
        {
          data: {
            quality: 5,
            deadline: 5,
            communication: 5,
            agreedPrice: 5,
            comment: substantiveComment,
            reviewedId: clientAgreement.clientId,
          },
        },
      );
      expect(selfShaped.status()).toBe(422);
      const weak = await clientPage.request.post(
        `/api/agreements/${clientAgreement.id}/reviews`,
        {
          data: {
            quality: 5,
            deadline: 5,
            communication: 5,
            agreedPrice: 5,
            comment: "too short",
          },
        },
      );
      expect(weak.status()).toBe(422);
      const outOfRange = await clientPage.request.post(
        `/api/agreements/${clientAgreement.id}/reviews`,
        {
          data: {
            quality: 6,
            deadline: 5,
            communication: 5,
            agreedPrice: 5,
            comment: substantiveComment,
          },
        },
      );
      expect(outOfRange.status()).toBe(422);

      await page.goto(`/${locale}/profiles/${providerAgreement.providerId}`);
      await expect(
        page.getByText(messages.reviews.overall).first(),
      ).toBeVisible();
      for (const label of [
        messages.reviews.quality,
        messages.reviews.deadline,
        messages.reviews.communication,
        messages.reviews.agreedPrice,
      ]) {
        await expect(page.getByText(label).first()).toBeVisible();
      }
      const [clientBeforeRedaction, providerBeforeRedaction] =
        await Promise.all([
          page.request.get(
            `/api/profiles/${providerAgreement.clientId}/reviews`,
          ),
          page.request.get(
            `/api/profiles/${providerAgreement.providerId}/reviews`,
          ),
        ]);
      for (const response of [clientBeforeRedaction, providerBeforeRedaction]) {
        expect(response.status()).toBe(200);
        expect((await response.json()).aggregate).toEqual({
          reviewCount: 1,
          overall: 4.5,
          quality: 5,
          deadline: 4,
          communication: 5,
          agreedPrice: 4,
        });
      }

      const published = await page.request.get("/api/admin/reviews");
      // A normal provider cannot enumerate the moderation queue.
      expect(published.status()).toBe(403);
    } finally {
      await clientContext.close();
    }

    const adminContext = await browser.newContext();
    try {
      const adminPage = await adminContext.newPage();
      await signInSeededAccount(adminPage, "admin", locale);
      const queue = await adminPage.request.get("/api/admin/reviews");
      expect(queue.status()).toBe(200);
      const { reviews } = (await queue.json()) as {
        reviews: readonly {
          id: string;
          reviewerDisplayName: string;
          status: "PUBLISHED" | "REDACTED";
        }[];
      };
      const providerReviewIndex = reviews.findIndex(
        (review) =>
          review.reviewerDisplayName === "Seeded Provider B" &&
          review.status === "PUBLISHED",
      );
      expect(providerReviewIndex).toBeGreaterThanOrEqual(0);
      await adminPage.goto(`/${locale}/admin/reviews`);
      // The queue API and rendered list share the repository's newest-first
      // projection. Use that verified index so both reviews with the same
      // tender title remain distinguishable without injecting test IDs.
      const row = adminPage
        .locator("ul.tender-list > li")
        .nth(providerReviewIndex);
      await row
        .getByLabel(messages.moderation.reason)
        .fill("The fixture review is removed from the public aggregate.");
      const redaction = adminPage.waitForResponse(
        (candidate) =>
          candidate.request().method() === "PATCH" &&
          candidate
            .url()
            .endsWith(`/api/admin/reviews/${reviews[providerReviewIndex]!.id}`),
      );
      await row
        .getByRole("button", { name: messages.moderation.redact })
        .click();
      expect((await redaction).status()).toBe(200);
      await expect
        .poll(async () => {
          const response = await adminPage.request.get("/api/admin/reviews");
          const body = (await response.json()) as {
            reviews: readonly { id: string; status: string }[];
          };
          return body.reviews.find(
            (review) => review.id === reviews[providerReviewIndex]!.id,
          )?.status;
        })
        .toBe("REDACTED");
      await adminPage.reload();
      await expect(
        adminPage
          .locator("ul.tender-list > li")
          .nth(providerReviewIndex)
          .getByText(messages.moderation.redacted),
      ).toBeVisible();
      const agreement = await phase4Agreement(page, "PROVIDER");
      const clientReviews = await page.request.get(
        `/api/profiles/${agreement.clientId}/reviews`,
      );
      const providerReviews = await page.request.get(
        `/api/profiles/${agreement.providerId}/reviews`,
      );
      expect((await clientReviews.json()).aggregate.reviewCount).toBe(0);
      expect((await providerReviews.json()).aggregate).toEqual({
        reviewCount: 1,
        overall: 4.5,
        quality: 5,
        deadline: 4,
        communication: 5,
        agreedPrice: 4,
      });
      await page.goto(`/${locale}/profiles/${agreement.providerId}`);
      await expect(page.getByText(substantiveComment)).toBeVisible();
    } finally {
      await adminContext.close();
    }
  });
}
