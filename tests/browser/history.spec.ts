import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("ledger history reconciles sample closes and exposes missing history and FX", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/analysis");
  await expect(
    page.getByRole("region", { name: "Daily ledger history" }),
  ).toContainText("$125,000.00");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Period gain" }),
  ).toContainText("$850.00");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Daily TWR estimate" }),
  ).toContainText("+0.68%");
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/ledger-history.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByLabel("From", { exact: true }).fill("2026-10-26");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await expect(
    page.getByRole("region", { name: "Daily ledger history" }),
  ).toContainText("Missing:");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Daily TWR estimate" }),
  ).toContainText("Unavailable");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
  ).toBe(false);
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/ledger-history-mobile.png",
    fullPage: true,
  });
  await page.goto("/settings/preferences");
  await page.getByLabel("Display currency").selectOption("EUR");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.goto("/analysis");
  await expect(
    page.getByRole("region", { name: "Daily ledger history" }),
  ).toContainText("FX USD/EUR");
  await expect(
    page.locator(".metric-card").filter({ hasText: "Ending value" }),
  ).toContainText("—");
});

test("changing portfolios ignores an older history response", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/portfolios/new");
  await page
    .getByLabel("Portfolio name", { exact: true })
    .fill("Empty account");
  await page
    .getByRole("button", { name: "Create portfolio", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Empty account." }),
  ).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let started!: () => void;
  const waiting = new Promise<void>((r) => (started = r));
  await page.route("**/v1/history?**", async (route) => {
    const response = await route.fetch();
    if (
      new URL(route.request().url()).searchParams.get("portfolioId") === "all"
    ) {
      started();
      await gate;
    }
    await route.fulfill({ response });
  });
  await page.goto("/analysis");
  await expect(
    page.getByRole("region", { name: "Daily ledger history" }),
  ).toContainText("$0.00");
  const select = page.getByRole("combobox", { name: "Analysis portfolio" });
  const empty = await select.inputValue();
  await select.selectOption("all");
  await waiting;
  await select.selectOption(empty);
  await expect(
    page.locator(".metric-card").filter({ hasText: "Ending value" }),
  ).toContainText("$0.00");
  release();
  await expect(
    page.locator(".metric-card").filter({ hasText: "Ending value" }),
  ).toContainText("$0.00");
});
