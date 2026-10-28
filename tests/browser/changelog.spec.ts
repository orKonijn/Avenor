import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("changelog uses repository notes, loads screenshots and works on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.getByRole("link", { name: "Changelog", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Version 1.1.0 — Unreleased",
    }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText("1.0.0");
  await expect(page.locator(".release-version")).toContainText("Current app version: 1.0.0");
  const images = page.getByRole("article").locator("img");
  await expect(images).toHaveCount(6);
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page
    .getByRole("navigation", { name: "Changelog sections" })
    .getByRole("link", { name: "Compatibility and migration" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compatibility and migration" }),
  ).toBeInViewport();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/changelog/changelog-page-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/overview");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("link", { name: "Changelog", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Version 1.1.0 — Unreleased",
    }),
  ).toBeVisible();
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
  ).toBe(false);
  await page.screenshot({ path: "docs/changelog/changelog-page-mobile.png" });
});
