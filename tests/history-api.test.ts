import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app";
import { createStore } from "../server/store";
test("history API is owned, dated, bounded and reconciles sample closes", async () => {
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const demo = await fetch(base + "/auth/demo", { method: "POST" });
    const cookie = demo.headers.get("set-cookie")!.split(";")[0];
    const url = base + "/history?from=2026-10-28&to=2026-10-28";
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const h = (await response.json()).data;
    assert.equal(h.endingValue, "125000");
    assert.equal(h.beginningValue, "124150");
    assert.equal(h.gain, "850");
    assert.equal(
      (
        await fetch(url + "&portfolioId=foreign", {
          headers: { Cookie: cookie },
        })
      ).status,
      404,
    );
    assert.equal(
      (await fetch(url + "&currency=BAD", { headers: { Cookie: cookie } }))
        .status,
      422,
    );
    assert.equal(
      (
        await fetch(base + "/history?from=2020-01-01&to=2026-10-28", {
          headers: { Cookie: cookie },
        })
      ).status,
      422,
    );
  } finally {
    server.close();
    await once(server, "close");
    store.db.close();
  }
});
