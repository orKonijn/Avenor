import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("empty sample setup resumes its draft and unknown-cost opening holdings can be corrected", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start an empty sample workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Start with your preferences" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Technology", exact: true }).click();
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/onboarding-preferences.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page
    .getByLabel("Portfolio name", { exact: true })
    .fill("A fresh start");
  await page.getByRole("button", { name: "Create & continue" }).click();
  await page.getByLabel("Opening cash").fill("500");
  await page.getByRole("button", { name: "Add opening holding" }).click();
  await page
    .getByRole("combobox", { name: "Asset", exact: true })
    .selectOption("msft-xnas");
  await page.getByLabel("Quantity", { exact: true }).fill("10");
  await page.getByLabel("I don’t know the cost basis").check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("draft saved");
  await page.reload();
  await expect(page.getByLabel("Opening cash")).toHaveValue("500");
  await expect(page.getByLabel("I don’t know the cost basis")).toBeChecked();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
  ).toBe(false);
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/onboarding-holdings-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Finish setup", exact: true }).click();
  await expect(page.locator(".featured>strong")).toHaveText("$4,700.00");
  await expect(
    page.locator(".metric-card").nth(1).locator("strong").first(),
  ).toHaveText("—");
  const response = await page.request.get("/v1/session");
  const session = (await response.json()).data;
  const opening = session.workspace.transactions.find(
    (t: any) => t.type === "opening",
  );
  page.on("dialog", (d) => d.accept());
  await page.goto(`/transactions/${opening.id}/edit`);
  await page.getByLabel("Unknown cost basis (gains unavailable)").uncheck();
  await page.getByLabel("Price per unit").fill("100");
  await page.getByRole("button", { name: "Save revision" }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded activity" }),
  ).toBeVisible();
  await page.goto("/overview");
  await expect(page.locator(".metric-card").nth(1)).toContainText("$3,200.00");
});
test("portfolio alert notification uses its fixed currency and links to the portfolio", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: /A clearer view/ }),
  ).toBeVisible();
  await page.goto("/alerts/new");
  await page.getByLabel("Alert type").selectOption("portfolio-value");
  await page.getByLabel("Threshold (USD)").fill("120000");
  await page.getByLabel("Notify now if").check();
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/portfolio-alert.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Create alert", exact: true }).click();
  await expect(page.locator(".alert-row")).toContainText("Paused");
  await page.goto("/settings/preferences");
  await page.getByLabel("Display currency").selectOption("EUR");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.goto("/alerts");
  await expect(page.locator(".alert-row")).toContainText("$120,000.00");
  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: /Portfolio value threshold crossed/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View context" }).click();
  await expect(
    page.getByRole("heading", { name: "Long-term investments." }),
  ).toBeVisible();
});
