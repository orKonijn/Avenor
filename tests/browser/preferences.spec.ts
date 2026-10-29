import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("saved spacing and interests persist, protect old forms, and retain mobile targets", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await page.goto("/watchlists");
  const row = page.locator(".asset-list-row").first();
  const comfortable = (await row.boundingBox())!.height;
  await page.goto("/settings/preferences");
  const second = await context.newPage();
  await second.goto("/settings/preferences");
  await second
    .getByRole("combobox", { name: "Spacing", exact: true })
    .selectOption("comfortable");
  await page
    .getByRole("combobox", { name: "Spacing", exact: true })
    .selectOption("compact");
  await page.getByRole("button", { name: "Technology", exact: true }).click();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Spacing", exact: true }),
  ).toHaveValue("compact");
  await expect(
    page.getByRole("button", { name: "Technology", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Technology", exact: true }),
  ).toHaveClass(/selected/);
  await page.screenshot({
    path: "docs/changelog/assets/unreleased/workspace-preferences.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto("/watchlists");
  expect((await row.boundingBox())!.height).toBeLessThan(comfortable);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHeight = (await row.boundingBox())!.height;
  await page.evaluate(
    () => (document.documentElement.dataset["density"] = "comfortable"),
  );
  expect((await row.boundingBox())!.height).toBe(mobileHeight);
  await page.goto("/settings/preferences");
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
  ).toBe(false);
  // Refresh the store while retaining the old form, before its first save.
  await second.evaluate(() => window.dispatchEvent(new Event("offline")));
  await second.getByRole("button", { name: "Reload data" }).click();
  await expect(second.locator("html")).toHaveAttribute(
    "data-density",
    "compact",
  );
  await expect(
    second.getByRole("combobox", { name: "Spacing", exact: true }),
  ).toHaveValue("comfortable");
  await second
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    second.getByRole("button", { name: "Load latest preferences" }),
  ).toBeVisible();
  await expect(
    second.getByRole("combobox", { name: "Spacing", exact: true }),
  ).toHaveValue("comfortable");
  // A general workspace reload must not lend a fresh revision to the stale form.
  await second.getByRole("button", { name: "Reload data" }).click();
  await expect(
    second.getByRole("button", { name: "Save preferences", exact: true }),
  ).toBeDisabled();
  await second.getByRole("button", { name: "Load latest preferences" }).click();
  await expect(
    second.getByRole("combobox", { name: "Spacing", exact: true }),
  ).toHaveValue("compact");
  await second
    .getByRole("combobox", { name: "Spacing", exact: true })
    .selectOption("comfortable");
  await second
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(second.locator("html")).toHaveAttribute(
    "data-density",
    "comfortable",
  );
  await second.close();
});

test("onboarding preferences remain editable after creating the first portfolio", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start an empty sample workspace" })
    .click();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await page
    .getByLabel("Portfolio name", { exact: true })
    .fill("Return to preferences");
  await page.getByRole("button", { name: "Create & continue" }).click();
  await expect(page.getByLabel("Opening cash")).toBeVisible();
  await page.getByRole("link", { name: "1. Preferences", exact: true }).click();
  await page.getByRole("button", { name: "Technology", exact: true }).click();
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByLabel("Opening cash")).toBeVisible();
  await page.getByRole("link", { name: "1. Preferences", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Technology", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
