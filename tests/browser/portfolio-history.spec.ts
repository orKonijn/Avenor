import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("archived records remain readable without changing active totals", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await expect(page.locator(".featured>strong")).toHaveText("$125,000.00");
  const result = await page.evaluate(async () => {
    const session = (await (await fetch("/v1/session")).json()).data;
    const write = async (path: string, method: string, body: unknown) => {
      const r = await fetch("/v1" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrf,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return (await r.json()).data;
    };
    const p = (
      await write("/portfolios", "POST", {
        name: "Completed goal",
        currency: "USD",
      })
    ).result;
    for (const [index, type] of ["deposit", "withdrawal"].entries()) {
      await write(`/portfolios/${p.id}/transactions`, "POST", {
        revision: p.revision + index,
        type,
        quantity: "1",
        price: "500",
        fee: "0",
        currency: "USD",
        effectiveAt: `2025-01-0${index + 1}`,
        note: "Goal cash",
      });
    }
    await write(`/portfolios/${p.id}`, "PATCH", {
      revision: p.revision + 2,
      archived: true,
    });
    return p.id;
  });
  await page.goto("/portfolios");
  await page
    .getByRole("link", { name: "Archived portfolios", exact: true })
    .click();
  await page.getByRole("link", { name: /Completed goal/ }).click();
  await expect(page).toHaveURL(new RegExp(`/portfolios/archived/${result}`));
  await expect(
    page.getByRole("region", { name: "Archived transactions" }),
  ).toContainText("withdrawal");
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".audit-entry")).toHaveCount(3);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/archived-history.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Completed goal." }),
  ).toBeVisible();
  await page.goto("/overview");
  await expect(page.locator(".featured>strong")).toHaveText("$125,000.00");
});

test("mobile currency filters and full table survive refresh with no page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/portfolios");
  await page
    .getByRole("combobox", { name: "Holding currency" })
    .selectOption("EUR");
  await expect(page.locator(".mobile-holdings")).toContainText(
    "No matching holdings",
  );
  await page
    .locator(".mobile-holdings")
    .getByRole("button", { name: "Clear filters" })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Holding currency" }),
  ).toHaveValue("");
  await page
    .getByRole("combobox", { name: "Holding currency" })
    .selectOption("USD");
  await page
    .getByRole("button", { name: "Show full table", exact: true })
    .click();
  await expect(page.locator(".holdings-table")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Holding currency" }),
  ).toHaveValue("USD");
  await expect(
    page.getByRole("button", { name: "Show holding cards" }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const width of [767, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
    ).toBe(false);
    await expect(page.locator(".holdings-table")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/holdings-mobile-table.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('holdings pagination uses the same rows in cards and table and resets after filtering', async ({ page }) => {
  // Expand a sample response solely to exercise the otherwise small fixture universe.
  await page.route('**/v1/auth/demo', async route => {
    const response = await route.fetch();
    const body = await response.json();
    const original = body.data.valuations.all.holdings[0];
    body.data.valuations.all.holdings = Array.from({length:26}, (_,i) => ({
      ...original, assetId:`fixture-${i}`, value:String(100+i),
      asset:{...original.asset,id:`fixture-${i}`,symbol:`FIX${String(i).padStart(2,'0')}`,name:`Fixture holding ${i}`},
    }));
    await route.fulfill({response,json:body});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Explore the sample workspace'}).click();
  await expect(page.locator('.featured>strong')).toBeVisible();
  await page.getByRole('link',{name:'Portfolio',exact:true}).click();
  await expect(page.locator('.mobile-holdings details')).toHaveCount(25);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.mobile-holdings details')).toHaveCount(1);
  await expect(page.locator('.mobile-holdings')).toContainText('FIX00');
  await page.getByRole('combobox',{name:'Holding currency'}).selectOption('EUR');
  await expect(page.locator('.table-footer')).toContainText('Page 1 of 1');
  await page.locator('.mobile-holdings').getByRole('button',{name:'Clear filters'}).click();
  await expect(page.locator('.mobile-holdings details')).toHaveCount(25);
  await page.getByRole('button',{name:'Show full table',exact:true}).click();
  await expect(page.locator('.holdings-table tbody tr')).toHaveCount(25);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await expect(page.locator('.holdings-table tbody tr')).toHaveCount(1);
});
