import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createMarket } from "../server/market";
import { createApp } from "../server/app";
import { createStore } from "../server/store";

test("provider quotes validate identity, currency, freshness and precision without sample fallback", async () => {
  let now = Date.parse("2026-10-29T15:00:00Z");
  let quote: any = {
    symbol: "MSFT",
    mic_code: "XNAS",
    currency: "USD",
    close: "420.123456789012345678",
    previous_close: "410",
    last_quote_at: now / 1000,
  };
  const market = createMarket({
    apiKey: "private-test-key",
    now: () => now,
    fetcher: (async (input: any) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://api.twelvedata.com");
      assert.equal(url.searchParams.get("mic_code"), "XNAS");
      return new Response(JSON.stringify(quote));
    }) as typeof fetch,
  });
  assert.equal(market.assets(false)[0].price, null);
  assert.equal(await market.refreshOne("msft-xnas"), true);
  assert.equal(market.assets(false)[0].price, "420.123456789012345678");
  assert.equal(market.assets(true)[0].price, "420");
  const valid = { ...quote };
  for (const patch of [
    { symbol: "OTHER" },
    { mic_code: "XNYS" },
    { currency: "EUR" },
    { last_quote_at: undefined },
    { last_quote_at: now / 1000 + 120 },
    { close: "NaN" },
    { close: "-1" },
  ]) {
    quote = { ...valid, ...patch };
    assert.equal(await market.refreshOne("msft-xnas"), false);
    assert.equal(market.assets(false)[0].price, null);
  }
  quote = valid;
  await market.refreshOne("msft-xnas");
  now += 25 * 60 * 60_000;
  assert.equal(market.assets(false)[0].price, null);
  assert.equal(await market.refreshOne("msft-xnas"), false);
  const offline = createMarket({ apiKey: "" });
  assert.equal(await offline.refreshOne("msft-xnas"), false);
  assert.ok(
    offline
      .assets(false)
      .every((a) => a.price === null && a.previousPrice === null),
  );
});

test("real sessions cannot receive sample quotes or synthetic themes from any read endpoint", async () => {
  const store = createStore(":memory:");
  const { app } = createApp(store, createMarket({ apiKey: "" }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const r = await fetch(base + "/auth/demo", { method: "POST" });
    const sample = (await r.json()).data;
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    assert.equal(sample.assets[0].price, "420");
    store.db.prepare("UPDATE users SET demo=0 WHERE id=?").run(sample.user.id);
    const read = async (path: string) =>
      (await (await fetch(base + path, { headers: { Cookie: cookie } })).json())
        .data;
    const real = await read("/session");
    assert.ok(real.assets.every((a: any) => a.price === null));
    assert.deepEqual(real.themes, []);
    assert.equal(real.valuations.all.value, null);
    assert.equal(real.market.dataStatus, "unavailable");
    assert.ok((await read("/assets")).every((a: any) => a.price === null));
    assert.equal((await read("/assets/msft-xnas")).price, null);
    assert.deepEqual(await read("/themes"), []);
    const holdings = await read(
      `/portfolios/${real.workspace.portfolios[0].id}/holdings`,
    );
    assert.equal(holdings.value, null);
  } finally {
    server.close();
    store.db.close();
  }
});
