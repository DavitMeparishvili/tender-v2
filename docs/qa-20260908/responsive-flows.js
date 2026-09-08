// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Playwright MCP entry point.
async function runResponsiveFlows(page) {
  const browser = page.context().browser(),
    base = "http://localhost:3000",
    results = [];
  for (const [mode, source, widths, paths] of [
    [
      "desktop-client",
      1,
      [1440, 720],
      [
        "/en/client",
        "/en/client/tenders",
        "/en/client/tenders/b1eca10a-976b-4e43-85c7-3b4e0700dc1c",
        "/en/client/agreements",
        "/en/agreements/346f7ea1-8f1f-401c-b116-38b182c51188",
        "/en/notifications",
        "/en/profile",
      ],
    ],
    [
      "desktop-provider",
      5,
      [1440, 720],
      [
        "/en/provider",
        "/en/provider/agreements",
        "/en/provider/tenders",
        "/en/provider/tenders/b1eca10a-976b-4e43-85c7-3b4e0700dc1c",
        "/en/profiles/WGbSuaGTxryANv4Tp3CbkgCmjXkvaW0y",
      ],
    ],
    [
      "mobile-client",
      4,
      [390, 320],
      [
        "/en/client",
        "/en/client/tenders",
        "/en/client/tenders/new?tenderId=5ada160d-94df-43a5-bf36-a51a144f5e38",
        "/en/client/tenders/b1eca10a-976b-4e43-85c7-3b4e0700dc1c",
        "/en/agreements/346f7ea1-8f1f-401c-b116-38b182c51188",
        "/en/notifications",
        "/en/profile",
      ],
    ],
    [
      "mobile-provider",
      2,
      [390, 320],
      [
        "/en/provider",
        "/en/provider/tenders",
        "/en/provider/tenders/b1eca10a-976b-4e43-85c7-3b4e0700dc1c",
        "/en/profiles/N1bXkRQi5PBuH8sRJAFBx6Jn0onB3LIF",
      ],
    ],
  ]) {
    const c = await browser.newContext({
      storageState: await browser.contexts()[source].storageState(),
      viewport: { width: widths[0], height: 900 },
      isMobile: mode.startsWith("mobile"),
      hasTouch: mode.startsWith("mobile"),
    });
    const p = await c.newPage(),
      errors = [],
      failures = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400)
        failures.push({ url: r.url().split("?")[0], status: r.status() });
    });
    for (const path of paths) {
      await p.goto(base + path);
      for (const width of widths) {
        await p.setViewportSize({ width, height: 900 });
        const layout = await p.evaluate(() => ({
          viewport: innerWidth,
          scroll: document.documentElement.scrollWidth,
          main: document.querySelectorAll("main").length,
        }));
        results.push({
          mode,
          path,
          width,
          ...layout,
          status:
            layout.scroll <= layout.viewport + 1 && layout.main === 1
              ? "PASS"
              : "FAIL",
        });
      }
    }
    if (mode.startsWith("mobile")) {
      await p.setViewportSize({ width: 320, height: 844 });
      await p.locator(".tender-mobile-locale summary").click();
      const labels = await p
        .locator(".tender-mobile-locale .locale-switcher")
        .innerText();
      results.push({
        mode,
        flow: "mobile-language",
        labels,
        status: labels.replace(/\s/g, "") === "KAENRU" ? "PASS" : "FAIL",
      });
    }
    results.push({
      mode,
      flow: "U03",
      errors,
      failures,
      status: errors.length || failures.length ? "FAIL" : "PASS",
    });
    await c.close();
  }
  return results;
}
