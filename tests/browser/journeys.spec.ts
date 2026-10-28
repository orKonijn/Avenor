import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: /A clearer view/ }),
  ).toBeVisible();
});
test("sample valuation, navigation, theme persistence and accessibility", async ({
  page,
}) => {
  await expect(page.locator(".featured>strong")).toHaveText("$125,000.00");
  await expect(page.locator(".metric-card").nth(1)).toContainText("$5,200.00");
  await page.screenshot({
    path: "docs/screenshots/overview-desktop.png",
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Toggle light and dark appearance" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "docs/screenshots/overview-dark.png",
    fullPage: true,
  });
  for (const path of [
    "/portfolios",
    "/analysis",
    "/discover",
    "/themes/intelligent-infrastructure",
    "/assets/msft-xnas",
    "/watchlists",
    "/alerts",
    "/notifications",
    "/settings/preferences",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
    ).toBe(false);
  }
});
test("create portfolio, deposit, buy, revise and retain audit history", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/portfolios/new");
  await page.getByLabel("Portfolio name", { exact: true }).fill("Travel fund");
  await page
    .getByRole("button", { name: "Create portfolio", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Travel fund." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add transaction" }).click();
  await page.getByLabel("Transaction type").selectOption("deposit");
  await page.getByLabel("Amount per unit").fill("1000");
  await page.getByRole("button", { name: "Review & save" }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded activity" }),
  ).toBeVisible();
  await expect(page.locator("table")).toContainText("deposit");
  await page.getByRole("link", { name: "Add transaction" }).click();
  await page
    .getByRole("combobox", { name: "Asset", exact: true })
    .selectOption("msft-xnas");
  await page.getByLabel("Quantity", { exact: false }).fill("2");
  await page.getByLabel("Price per unit").fill("100");
  await page.getByLabel("Fee", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Review & save" }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded activity" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit", exact: true }).first().click();
  await page.getByLabel("Price per unit").fill("120");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded activity" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Audit history" }).click();
  await expect(page.locator(".audit-entry")).toHaveCount(3);
});
test("watchlist creation, alert crossing and read notification", async ({
  page,
}) => {
  await page.goto("/watchlists");
  await page.getByRole("button", { name: "New watchlist" }).click();
  await page.getByLabel("Watchlist name", { exact: true }).fill("Research");
  await page.getByRole("button", { name: "Create watchlist" }).click();
  await expect(
    page.getByRole("heading", { name: "Research", exact: true }),
  ).toBeVisible();
  await page.goto("/alerts/new?assetId=msft-xnas");
  await page.getByLabel("Threshold (USD)").fill("430");
  await page
    .getByRole("button", { name: "Create alert", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: /MSFT rises above/ }),
  ).toBeVisible();
  await page.getByText("Try a sample observation").click();
  await page.getByLabel("Sample price (USD)").fill("440");
  await page.getByRole("button", { name: "Evaluate observation" }).click();
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: /Price threshold crossed/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await page.getByRole("button", { name: "Unread", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all caught up" }),
  ).toBeVisible();
});
test("mobile layouts remain usable down to 320px", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      "/overview",
      "/portfolios",
      "/discover",
      "/transactions/new",
      "/settings/preferences",
      "/alerts/new",
    ]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page
          .locator("body")
          .evaluate((el) => el.scrollWidth > innerWidth),
        `${path} at ${width}px`,
      ).toBe(false);
    }
    await page.goto("/overview");
    await page.screenshot({
      path: `docs/screenshots/overview-${width}.png`,
      fullPage: true,
    });
  }
});
