import { test, expect } from "@playwright/test";
test("uncertain save retries the original request without a duplicate ledger entry", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: /A clearer view/ }),
  ).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/transactions/new?portfolioId=long-term");
  await page.getByLabel("Transaction type").selectOption("deposit");
  await page.getByLabel("Amount per unit").fill("100");
  let intercepted = false;
  await page.route("**/v1/portfolios/long-term/transactions", async (route) => {
    if (!intercepted && route.request().method() === "POST") {
      intercepted = true;
      await route.fetch();
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ message: "Gateway response lost" }),
      });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Review & save" }).click();
  await expect(
    page.getByRole("button", { name: "Retry original save" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount per unit")).toBeDisabled();
  await page.getByRole("button", { name: "Retry original save" }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded activity" }),
  ).toBeVisible();
  const session = await page.request.get("/v1/session");
  const data = (await session.json()).data;
  expect(
    data.workspace.transactions.filter((t: any) => t.type === "deposit"),
  ).toHaveLength(2);
  expect(data.valuations["long-term"].value).toBe("125100");
});
test("revoked session clears private state and returns to sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore the sample workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: /A clearer view/ }),
  ).toBeVisible();
  const response = await page.request.get("/v1/session");
  const session = (await response.json()).data;
  await page.request.post("/v1/logout", {
    headers: { "X-CSRF-Token": session.csrf },
    data: {},
  });
  await page
    .getByRole("button", { name: "Toggle light and dark appearance" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByText("$125,000.00", { exact: true })).toHaveCount(0);
});
