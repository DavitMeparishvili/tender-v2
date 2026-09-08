// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Playwright MCP entry point.
async function runAuthFlows(page) {
  const base = "http://localhost:3000",
    browser = page.context().browser(),
    results = [];
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  for (const [mode, role, index] of [
    ["desktop", "client", 1],
    ["desktop", "provider", 2],
    ["mobile", "client", 3],
    ["mobile", "provider", 4],
  ]) {
    const context = await browser.newContext({
      viewport:
        mode === "desktop"
          ? { width: 1440, height: 900 }
          : { width: 390, height: 844 },
      isMobile: mode === "mobile",
      hasTouch: mode === "mobile",
    });
    const p = await context.newPage();
    p.setDefaultTimeout(15000);
    const runTag = Date.now().toString().slice(-6);
    const phone = "+995555" + runTag.slice(0, 5) + index;
    const email =
        "qa.mcp.20260908." + mode + "." + role + "." + runTag + "@tender.test",
      password = "QaMcp" + Date.now() + "!";
    try {
      await p.goto(base + "/en/register/" + role);
      await p
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await p
        .getByRole("alert")
        .filter({ hasText: "problems to fix" })
        .waitFor();
      for (const [label, value] of Object.entries({
        Name: "QA MCP " + mode + " " + role,
        "ID number": "9999" + runTag + index,
        "City or town": "Tbilisi",
        "Street address": "99 QA Test Street",
        "Email address": email,
        Password: password,
        "Confirm password": password,
      }))
        await p.getByLabel(label, { exact: true }).fill(value);
      await p
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Check your inbox", exact: true })
        .waitFor();
      const mail = await p.request
        .get(
          base +
            "/api/test/mailbox?address=" +
            email +
            "&template=VERIFY_EMAIL",
        )
        .then((r) => r.json());
      await p.goto(mail.message.variables.verificationUrl);
      await p
        .getByRole("button", { name: "Complete profile", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "Complete profile", exact: true })
        .click();
      await p
        .getByRole("alert")
        .filter({ hasText: /problems to fix/ })
        .waitFor();
      if (role === "provider")
        await p
          .getByLabel("Account type", { exact: true })
          .selectOption("COMPANY");
      for (const [label, value] of Object.entries({
        "Public display name": "QA MCP " + mode + " " + role,
        "Phone number": phone,
        City: "Tbilisi",
        "Activity description":
          "QA verification of construction and renovation service workflows.",
      }))
        await p.getByLabel(label, { exact: true }).fill(value);
      await p.route("**/api/onboarding/complete", (route) => route.abort(), {
        times: 1,
      });
      await p
        .getByRole("button", { name: "Complete profile", exact: true })
        .click();
      await p
        .getByRole("alert")
        .filter({ hasText: "We could not complete that request." })
        .waitFor();
      assert(
        await p
          .getByRole("button", { name: "Complete profile", exact: true })
          .isEnabled(),
        "Onboarding cannot retry after network failure",
      );
      const onboarding = p.waitForResponse((r) =>
        r.url().endsWith("/api/onboarding/complete"),
      );
      await p
        .getByRole("button", { name: "Complete profile", exact: true })
        .click();
      assert((await onboarding).ok(), "Onboarding rejected");
      await p
        .getByRole("heading", {
          name: role === "client" ? "Client workspace" : "Provider workspace",
          exact: true,
        })
        .waitFor();
      results.push({
        mode,
        flow: role === "client" ? "A03" : "A04",
        status: "PASS",
        email,
      });
      await p.getByRole("link", { name: /Edit profile/ }).click();
      await p.waitForURL(/\/profile$/);
      await p.getByLabel("Phone number", { exact: true }).fill("bad");
      await p
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await p
        .getByRole("alert")
        .filter({ hasText: /problem/ })
        .waitFor();
      await p.getByLabel("Phone number", { exact: true }).fill(phone);
      await p
        .getByLabel("Public display name", { exact: true })
        .fill("QA MCP " + mode + " " + role + " updated");
      const save = p.waitForResponse(
        (r) =>
          r.url().endsWith("/api/profile/me") &&
          r.request().method() === "PATCH",
      );
      await p
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      assert((await save).ok(), "Profile save rejected");
      await p.reload();
      assert(
        (
          await p
            .getByLabel("Public display name", { exact: true })
            .inputValue()
        ).endsWith("updated"),
        "Profile did not persist",
      );
      await p.screenshot({
        path:
          "C:/Users/mefar/repos/tender-v2/docs/qa-20260908/" +
          mode +
          "-" +
          role +
          "-profile.png",
        fullPage: true,
      });
      results.push({ mode, flow: "P01", status: "PASS" });
      await p.goto(base + "/en/" + role);
      await p.getByRole("button", { name: "Sign out", exact: true }).click();
      await p.waitForURL(/\/en(?:\/login)?$/);
      await p.goto(base + "/en/profile");
      assert(p.url().includes("/login"), "Signed-out profile accessible");
      await p.getByLabel("Email address", { exact: true }).fill(email);
      await p.getByLabel("Password", { exact: true }).fill("wrong-password");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p
        .getByRole("alert")
        .filter({ hasText: /problem/ })
        .waitFor();
      await p.getByLabel("Password", { exact: true }).fill(password);
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p
        .getByRole("heading", {
          name: role === "client" ? "Client workspace" : "Provider workspace",
          exact: true,
        })
        .waitFor();
      results.push({ mode, flow: "A01/A02", status: "PASS" });
      await p.goto(base + "/en/reset-password");
      await p
        .getByRole("heading", { name: "This link is not valid", exact: true })
        .waitFor();
      await p
        .getByRole("link", { name: "Send reset link", exact: true })
        .click();
      await p.waitForURL(/\/forgot-password$/);
      await p.getByLabel("Email address", { exact: true }).fill(email);
      await p
        .getByRole("button", { name: "Send reset link", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Check your email", exact: true })
        .waitFor();
      const reset = await p.request
        .get(
          base +
            "/api/test/mailbox?address=" +
            email +
            "&template=RESET_PASSWORD",
        )
        .then((r) => r.json());
      await p.goto(reset.message.variables.resetUrl);
      await p.getByLabel("New password", { exact: true }).fill(password + "R");
      await p.getByLabel("Confirm password", { exact: true }).fill("mismatch");
      await p
        .getByRole("button", { name: "Reset password", exact: true })
        .click();
      await p
        .getByRole("alert")
        .filter({ hasText: /problem/ })
        .waitFor();
      await p
        .getByLabel("Confirm password", { exact: true })
        .fill(password + "R");
      await p
        .getByRole("button", { name: "Reset password", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Password updated", exact: true })
        .waitFor();
      await context.clearCookies();
      await p.goto(base + "/en/login");
      await p.getByLabel("Email address", { exact: true }).fill(email);
      await p.getByLabel("Password", { exact: true }).fill(password + "R");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p
        .getByRole("heading", {
          name: role === "client" ? "Client workspace" : "Provider workspace",
          exact: true,
        })
        .waitFor();
      results.push({ mode, flow: "A05", status: "PASS" });
    } catch (error) {
      results.push({
        mode,
        role,
        status: "FAIL",
        error: String(error),
        url: p.url(),
        text: (await p.locator("main").innerText()).slice(0, 1300),
      });
    }
    await context.close();
  }
  return results;
}
