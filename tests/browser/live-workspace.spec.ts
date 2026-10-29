import { test, expect } from "@playwright/test";
import { once } from "node:events";
import { createHash, randomUUID } from "node:crypto";
import { createApp } from "../../server/app";
import { createStore } from "../../server/store";
import { createMarket } from "../../server/market";
import { newWorkspace } from "../../server/sample";

test("personal workspace hides fixtures when provider quotes are unavailable", async ({
  page,
  context,
}) => {
  const store = createStore(":memory:");
  const { app } = createApp(store, createMarket({ apiKey: "" }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const id = randomUUID(),
    token = randomUUID();
  const w = newWorkspace();
  w.preferences.onboarding = 3;
  w.portfolios.push({
    id: "personal",
    name: "Personal investments",
    currency: "USD",
    revision: 0,
    archived: false,
  });
  w.transactions.push(
    {
      id: "cash",
      portfolioId: "personal",
      type: "deposit",
      effectiveAt: "2026-01-01T00:00:00Z",
      quantity: "1",
      price: "1000",
      fee: "0",
      currency: "USD",
      note: "",
      revision: 0,
    },
    {
      id: "shares",
      portfolioId: "personal",
      type: "opening",
      effectiveAt: "2026-01-01T00:00:00Z",
      assetId: "msft-xnas",
      quantity: "2",
      price: "200",
      fee: "0",
      currency: "USD",
      note: "",
      revision: 0,
    },
  );
  store.db
    .prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)")
    .run(
      id,
      "owner@example.invalid",
      "Private owner",
      "unused",
      1,
      0,
      JSON.stringify(w),
    );
  store.db
    .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
    .run(
      createHash("sha256").update(token).digest("hex"),
      id,
      randomUUID(),
      Date.now() + 60000,
    );
  try {
    await context.addCookies([
      {
        name: "avenor_session",
        value: token,
        url: base,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await page.goto(base + "/overview");
    await expect(
      page.getByRole("heading", { name: "Historical market data unavailable" }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Opening sample");
    await expect(page.locator("main")).toContainText("Personal ledger");
    await expect(page.locator("main")).toContainText(
      "Market quotes unavailable",
    );
    await page.screenshot({
      path: "docs/changelog/assets/unreleased/private-live-workspace.png",
      fullPage: true,
    });
    await page.goto(base + "/assets/msft-xnas");
    await expect(page.locator("main")).toContainText(
      "Provider quote unavailable",
    );
    await expect(page.locator("main")).not.toContainText("SAMPLE QUOTE");
    await page.goto(base + "/analysis?tab=risk");
    await expect(page.locator("main")).toContainText("Historical drawdown");
    await expect(page.locator("main")).not.toContainText("Fixture drawdown");
  } finally {
    await page.goto("about:blank");
    server.close();
    store.db.close();
  }
});
