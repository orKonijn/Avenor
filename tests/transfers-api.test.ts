import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app";
import { createStore } from "../server/store";
test("transfers are atomic, owned, idempotent and cannot be edited as separate transactions", async () => {
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const response = await fetch(base + "/auth/demo", { method: "POST" });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const session = (await response.json()).data;
    const call = async (
      path: string,
      method: string,
      body: unknown,
      key = crypto.randomUUID(),
    ) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrf,
          "Idempotency-Key": key,
        },
        body: JSON.stringify(body),
      });
      return { status: r.status, ...(await r.json()) };
    };
    const source = session.workspace.portfolios[0];
    const created = await call("/portfolios", "POST", {
      name: "Cash reserve",
      currency: "USD",
    });
    const destination = created.data.result;
    const body = {
      sourcePortfolioId: source.id,
      destinationPortfolioId: destination.id,
      sourceRevision: source.revision,
      destinationRevision: destination.revision,
      currency: "USD",
      amount: "100",
      effectiveAt: "2026-10-28T00:00:00Z",
    };
    const key = crypto.randomUUID();
    assert.equal(
      (
        await call("/transfers", "POST", {
          ...body,
          destinationPortfolioId: "foreign",
        })
      ).status,
      404,
    );
    const done = await call("/transfers", "POST", body, key);
    assert.equal(done.status, 200);
    const id = done.data.result.id;
    const replay = await call("/transfers", "POST", body, key);
    assert.equal(
      replay.data.workspace.transactions.filter((t: any) => t.transferId === id)
        .length,
      2,
    );
    const leg = done.data.workspace.transactions.find(
      (t: any) => t.transferId === id,
    );
    assert.equal(
      (
        await call("/transactions/" + leg.id, "PATCH", {
          ...leg,
          revision: source.revision + 1,
          price: "200",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await call("/transactions/" + leg.id + "/void", "POST", {
          revision: source.revision + 1,
        })
      ).status,
      422,
    );
    const conflict = await call("/transfers", "POST", body);
    assert.equal(conflict.status, 409);
    const voided = await call("/transfers/" + id + "/void", "POST", {
      sourceRevision: source.revision + 1,
      destinationRevision: destination.revision + 1,
    });
    assert.equal(voided.status, 200);
    assert.ok(
      voided.data.workspace.transactions
        .filter((t: any) => t.transferId === id)
        .every((t: any) => t.voided),
    );
    const foreignResponse = await fetch(base + "/auth/demo", {
      method: "POST",
    });
    const foreign = (await foreignResponse.json()).data;
    const forbidden = await fetch(base + "/transfers/" + id + "/void", {
      method: "POST",
      headers: {
        Cookie: foreignResponse.headers.get("set-cookie")!.split(";")[0],
        "Content-Type": "application/json",
        "X-CSRF-Token": foreign.csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ sourceRevision: 2, destinationRevision: 2 }),
    });
    assert.equal(forbidden.status, 404);
  } finally {
    server.close();
    await once(server, "close");
    store.db.close();
  }
});
