import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("cash transfers reconcile both portfolios and can only be voided together", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/portfolios/new");
  await page.getByLabel("Portfolio name", { exact: true }).fill("Cash reserve");
  await page
    .getByRole("button", { name: "Create portfolio", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Cash reserve." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Transfer cash" }).click();
  await page
    .getByLabel("From portfolio")
    .selectOption({ label: "Long-term investments" });
  await page.getByLabel("To portfolio").selectOption({ label: "Cash reserve" });
  await page.getByLabel("Transfer amount").fill("200");
  await page.getByLabel("Transfer date (UTC)").fill("2026-10-28");
  await page
    .getByRole("button", { name: "Record transfer", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Recorded transfer");
  await expect(page.locator("main h2")).toHaveText("$200.00");
  const receipt = page.url();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/portfolio-transfer.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "View destination records" }).click();
  await expect(page.locator("table")).toContainText("deposit");
  await expect(page.getByRole("link", { name: "View transfer" })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await page.goto(receipt);
  await page
    .getByRole("button", { name: "Void transfer", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Voided transfer");
  await page.goto("/overview");
  await page.getByRole("combobox").first().selectOption("all");
  await expect(page.locator(".featured>strong")).toHaveText("$125,000.00");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/transfers/new");
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
  ).toBe(false);
});
test("uncertain transfer retry preserves one linked pair", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/portfolios/new");
  await page.getByLabel("Portfolio name", { exact: true }).fill("Reserve");
  await page
    .getByRole("button", { name: "Create portfolio", exact: true })
    .last()
    .click();
  await expect(page.getByRole("heading", { name: "Reserve." })).toBeVisible();
  await page.goto("/transfers/new");
  await page
    .getByLabel("From portfolio")
    .selectOption({ label: "Long-term investments" });
  await page.getByLabel("To portfolio").selectOption({ label: "Reserve" });
  await page.getByLabel("Transfer amount").fill("100");
  await page.getByLabel("Transfer date (UTC)").fill("2026-10-28");
  let failed = false;
  await page.route("**/v1/transfers", async (route) => {
    const response = await route.fetch();
    if (!failed) {
      failed = true;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ message: "Connection interrupted after save" }),
      });
    } else await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Record transfer", exact: true })
    .click();
  await expect(page.getByLabel("Transfer amount")).toBeDisabled();
  await page.getByRole("button", { name: "Retry transfer" }).click();
  await expect(page.locator("main")).toContainText("Recorded transfer");
  const pairs = await page.evaluate(async () => {
    const d = (await (await fetch("/v1/session")).json()).data;
    return d.workspace.transactions.filter((t: any) => t.transferId).length;
  });
  expect(pairs).toBe(2);
});

test("an uncertain void stays attached to its receipt during browser Back", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/portfolios/new");
  await page.getByLabel("Portfolio name", { exact: true }).fill("Void reserve");
  await page
    .getByRole("button", { name: "Create portfolio", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Void reserve." }),
  ).toBeVisible();
  await page.goto("/transfers/new");
  await page
    .getByLabel("From portfolio")
    .selectOption({ label: "Long-term investments" });
  await page.getByLabel("To portfolio").selectOption({ label: "Void reserve" });
  await page.getByLabel("Transfer amount").fill("100");
  await page.getByLabel("Transfer date (UTC)").fill("2026-10-28");
  await page
    .getByRole("button", { name: "Record transfer", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Recorded transfer");
  const receipt = page.url();
  let failed = false;
  await page.route("**/v1/transfers/*/void", async (route) => {
    const response = await route.fetch();
    if (!failed) {
      failed = true;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ message: "Connection interrupted after void" }),
      });
    } else await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Void transfer", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "void outcome is uncertain",
  );
  await page.goBack();
  await expect(page).toHaveURL(receipt);
  await expect(page.locator(".banner.error")).toContainText(
    "Reconcile the pending",
  );
  await page
    .getByRole("button", { name: "Void transfer", exact: true })
    .click();
  await expect(page.locator("main")).toContainText("Voided transfer");
});
