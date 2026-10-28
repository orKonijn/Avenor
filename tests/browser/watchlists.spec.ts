import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("watchlist edits from two tabs retain the latest change and recover safely", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/watchlists");
  const second = await context.newPage();
  await second.goto("/watchlists");
  const firstList = page.locator("section.panel").first();
  const staleList = second.locator("section.panel").first();
  await expect(
    staleList.getByRole("button", { name: "Rename", exact: true }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept("Long-term research"));
  await firstList.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(
    firstList.getByRole("heading", { name: "Long-term research" }),
  ).toBeVisible();
  second.once("dialog", (d) => d.accept("Stale name"));
  await staleList.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(
    second.getByText(/The latest lists are now loaded/),
  ).toBeVisible();
  await expect(
    staleList.getByRole("heading", { name: "Long-term research" }),
  ).toBeVisible();
  await second.screenshot({
    path: "docs/changelog/assets/unreleased/watchlist-conflict.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page: second })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await second.setViewportSize({ width: 390, height: 844 });
  expect(
    await second.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
  ).toBe(false);
  second.once("dialog", (d) => d.accept("Reviewed research"));
  await staleList.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(
    staleList.getByRole("heading", { name: "Reviewed research" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    firstList.getByRole("heading", { name: "Reviewed research" }),
  ).toBeVisible();
  await second.close();
});
