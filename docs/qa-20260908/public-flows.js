// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Playwright MCP entry point.
async function runPublicFlows(page) {
  const browser = page.context().browser(),
    base = "http://localhost:3000",
    results = [];
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  for (const mode of ["desktop", "mobile"]) {
    const c = await browser.newContext({
      viewport:
        mode === "desktop"
          ? { width: 1440, height: 900 }
          : { width: 390, height: 844 },
      isMobile: mode === "mobile",
      hasTouch: mode === "mobile",
    });
    const p = await c.newPage();
    p.setDefaultTimeout(15000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    try {
      await p.goto(base + "/");
      assert(p.url().endsWith("/ka"), "Wrong default locale");
      for (const [locale, label] of [
        ["en", "English"],
        ["ru", "Русский"],
        ["ka", "ქართული"],
        ["en", "English"],
      ]) {
        if (mode === "mobile") await p.locator("header summary").click();
        await p.getByRole("link", { name: label, exact: true }).click();
        await p.waitForURL(base + "/" + locale);
        assert((await p.locator("h1").count()) === 1, "Missing locale heading");
      }
      const anchors = await p
        .locator('a[href*="#"]')
        .evaluateAll((es) =>
          es
            .filter((e) => !document.getElementById(e.hash.slice(1)))
            .map((e) => e.href),
        );
      assert(!anchors.length, "Broken home anchor");
      await p.screenshot({
        path:
          "C:/Users/mefar/repos/tender-v2/docs/qa-20260908/" +
          mode +
          "-homepage.png",
        fullPage: true,
      });
      results.push({ mode, flow: "G01/G02", status: "PASS" });
      await p
        .getByRole("searchbox", { name: "Search open tenders", exact: true })
        .fill("Tbilisi");
      await p.getByRole("button", { name: "Search", exact: true }).click();
      await p.waitForURL(/provider\/tenders\?/);
      assert(p.url().includes("city=Tbilisi"), "Search lost city");
      await p
        .getByRole("link", { name: "Highest budget", exact: true })
        .click();
      await p.waitForURL(/sort=budget/);
      if (mode === "mobile")
        await p.getByRole("button", { name: /^Filters/ }).click();
      await p
        .getByRole("combobox", { name: "Service category", exact: true })
        .selectOption("TRANSPORT");
      await p
        .getByRole("button", { name: "Apply filters", exact: true })
        .click();
      await p.waitForURL(/specialty=TRANSPORT/);
      await p
        .getByText("No published tenders match your filters yet.", {
          exact: true,
        })
        .waitFor();
      await p
        .getByRole("link", {
          name: "Remove filter Transport & delivery",
          exact: true,
        })
        .click();
      await p.waitForURL((u) => !u.searchParams.has("specialty"));
      if (mode === "mobile")
        await p.getByRole("button", { name: /^Filters/ }).click();
      await p.getByLabel("Minimum budget", { exact: true }).fill("1000");
      await p.getByLabel("Maximum budget", { exact: true }).fill("200000");
      await p.getByRole("radio", { name: "GEL", exact: true }).check();
      await p
        .getByRole("button", { name: "Apply filters", exact: true })
        .click();
      await p.waitForURL(/minBudget=1000/);
      await p
        .getByRole("link", { name: "Closing soonest", exact: true })
        .click();
      await p.waitForURL(/sort=closing/);
      if (mode === "mobile")
        await p.getByRole("button", { name: /^Filters/ }).click();
      await p.getByRole("link", { name: "Clear all", exact: true }).click();
      await p.waitForURL(base + "/en/provider/tenders");
      await p
        .getByRole("searchbox", { name: "City", exact: true })
        .fill("NoSuchQaCity");
      await p.getByRole("button", { name: "Search", exact: true }).click();
      await p.waitForURL(/city=NoSuchQaCity/);
      await p
        .getByText("No published tenders match your filters yet.", {
          exact: true,
        })
        .waitFor();
      await p
        .getByRole("link", { name: "Remove filter NoSuchQaCity", exact: true })
        .click();
      await p.waitForURL(base + "/en/provider/tenders");
      await p.screenshot({
        path:
          "C:/Users/mefar/repos/tender-v2/docs/qa-20260908/" +
          mode +
          "-discovery.png",
        fullPage: true,
      });
      results.push({ mode, flow: "G04", status: "PASS" });
      const detail = p
        .locator(".result-list a")
        .filter({ hasText: "View details" })
        .first();
      await detail.click();
      await p.waitForURL(/provider\/tenders\/[\w-]+$/);
      const text = await p.locator("#main-content").innerText();
      assert(!text.includes("@tender.test"), "Guest identity leaked");
      assert(
        (await p
          .getByRole("button", { name: "Send offer", exact: true })
          .count()) === 0,
        "Guest can bid",
      );
      await p.locator(".leaflet-container").first().waitFor();
      assert((await p.locator(".leaflet-container").count()) > 0, "No map");
      await p.screenshot({
        path:
          "C:/Users/mefar/repos/tender-v2/docs/qa-20260908/" +
          mode +
          "-locked-detail.png",
        fullPage: true,
      });
      results.push({
        mode,
        flow: "G03/G05",
        status: "PASS",
        note: "Detail map; discovery has no map/list switch",
      });
      for (const path of [
        "/en/profile",
        "/en/client",
        "/en/provider",
        "/en/notifications",
      ]) {
        await p.goto(base + path);
        assert(
          p.url().includes("/login"),
          "Protected route accessible: " + path,
        );
      }
      results.push({ mode, flow: "A02", status: "PASS" });
      for (const path of [
        "/en/not-a-real-page",
        "/en/provider/tenders/00000000-0000-0000-0000-000000000000",
      ]) {
        const response = await p.goto(base + path);
        assert(response.status() === 404, "Missing page should be 404");
        assert(
          (await p.locator("body").innerText()).length > 50,
          "Blank error page",
        );
      }
      await p.goto(base + "/en");
      await p.keyboard.press("Tab");
      const focused = await p.evaluate(() => ({
        tag: document.activeElement.tagName,
        text: document.activeElement.textContent,
      }));
      assert(focused.tag === "A", "Skip link not keyboard reachable");
      for (const width of mode === "mobile" ? [390, 320] : [1440]) {
        await p.setViewportSize({
          width,
          height: mode === "mobile" ? 844 : 900,
        });
        const dimensions = await p.evaluate(() => ({
          viewport: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        assert(
          dimensions.scroll <= dimensions.viewport + 1,
          "Home horizontal overflow",
        );
      }
      results.push({
        mode,
        flow: "U01/U02",
        status: "PASS",
        pageErrors: errors,
      });
      assert(!errors.length, "Unexpected browser errors");
    } catch (error) {
      results.push({
        mode,
        status: "FAIL",
        error: String(error),
        url: p.url(),
        text: (await p.locator("body").innerText()).slice(0, 1000),
      });
    }
    await c.close();
  }
  return results;
}
