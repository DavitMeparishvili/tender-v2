import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";

test("@phase-2 leaving pin adjustment during a zoom keeps the authoring page usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signInSeededAccount(page, "client", "ka");
  await page.goto("/ka/client/tenders/new");
  await page
    .getByLabel(messagesFor("ka").tenders.city, { exact: true })
    .selectOption("611717");
  const adjust = page.locator(".authoring-map-adjust");
  const map = page.locator(".authoring-map .location-map");
  for (let attempt = 0; attempt < 3; attempt++) {
    await adjust.click();
    await expect(map).toHaveAttribute("data-interactive", "true");
    await expect(map).toHaveClass(/leaflet-container/);
    await map.click({ position: { x: 120, y: 120 } });
    await adjust.click();
    await expect(map).toHaveAttribute("data-interactive", "false");
    await expect(map.locator(".location-map-pin")).toBeAttached();
  }
  // The reported crash arrived from Leaflet's delayed zoom completion.
  await page.waitForTimeout(350);
  expect(errors).toEqual([]);
  await expect(adjust).toBeVisible();
});
