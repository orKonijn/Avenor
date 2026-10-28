import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app";
import { createStore } from "../server/store";
test("sessions, CSRF, owner isolation, atomic edits, idempotency and conflicts", async () => {
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const anonymous = await fetch(base + "/session");
    assert.equal(anonymous.status, 401);
    const demo = await fetch(base + "/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const cookie = demo.headers.get("set-cookie")!.split(";")[0];
    const session = (await demo.json()).data;
    assert.ok(demo.headers.get("set-cookie")!.includes("HttpOnly"));
    const request = async (
      path: string,
      method = "GET",
      body?: unknown,
      key = crypto.randomUUID(),
      csrf = session.csrf,
    ) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          "Idempotency-Key": key,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    assert.equal(
      (
        await request(
          "/portfolios",
          "POST",
          { name: "No CSRF", currency: "USD" },
          undefined,
          "bad",
        )
      ).status,
      403,
    );
    const p = await request("/portfolios", "POST", {
      name: "Test",
      currency: "USD",
    });
    assert.equal(p.status, 200);
    const id = p.body.data.result.id;
    const body = {
      type: "deposit",
      quantity: "1",
      price: "1000",
      fee: "0",
      currency: "USD",
      effectiveAt: "2025-01-01T00:00:00Z",
      revision: 0,
    };
    const key = crypto.randomUUID();
    const first = await request(
      `/portfolios/${id}/transactions`,
      "POST",
      body,
      key,
    );
    assert.equal(first.status, 200);
    const duplicate = await request(
      `/portfolios/${id}/transactions`,
      "POST",
      body,
      key,
    );
    assert.deepEqual(duplicate.body.data, first.body.data);
    assert.equal(
      (
        await request(
          `/portfolios/${id}/transactions`,
          "POST",
          { ...body, price: "2000" },
          key,
        )
      ).status,
      409,
    );
    const concurrent = await Promise.all([
      request(`/portfolios/${id}/transactions`, "POST", {
        ...body,
        revision: 1,
      }),
      request(`/portfolios/${id}/transactions`, "POST", {
        ...body,
        revision: 1,
      }),
    ]);
    assert.deepEqual(concurrent.map((x) => x.status).sort(), [200, 409]);
    const buy = await request(`/portfolios/${id}/transactions`, "POST", {
      ...body,
      type: "buy",
      assetId: "msft-xnas",
      quantity: "2",
      price: "100",
      revision: 2,
    });
    assert.equal(buy.status, 200);
    const replayAfterNewerWrites = await request(
      `/portfolios/${id}/transactions`,
      "POST",
      body,
      key,
    );
    assert.equal(
      replayAfterNewerWrites.body.data.result.id,
      first.body.data.result.id,
    );
    assert.equal(
      replayAfterNewerWrites.body.data.workspace.portfolios.find(
        (p: any) => p.id === id,
      ).revision,
      3,
    );
    assert.equal(
      replayAfterNewerWrites.body.data.workspace.transactions.length,
      buy.body.data.workspace.transactions.length,
    );
    const invalid = await request(`/portfolios/${id}/transactions`, "POST", {
      ...body,
      type: "sell",
      assetId: "msft-xnas",
      quantity: "3",
      price: "100",
      revision: 3,
    });
    assert.equal(invalid.status, 422);
    const state = await request("/session");
    assert.equal(
      state.body.data.workspace.portfolios.find((p: any) => p.id === id)
        .revision,
      3,
    );
    const other = await fetch(base + "/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const otherCookie = other.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await fetch(base + `/portfolios/${id}/holdings`, {
          headers: { Cookie: otherCookie },
        })
      ).status,
      404,
    );
    const originalCount = state.body.data.workspace.transactions.length;
    const txId = first.body.data.result.id;
    const voided = await request(`/transactions/${txId}/void`, "POST", {
      revision: 3,
    });
    assert.equal(voided.status, 200);
    assert.equal(voided.body.data.workspace.transactions.length, originalCount);
    assert.ok(
      voided.body.data.workspace.audit.some(
        (a: any) => a.entityId === txId && a.action === "void",
      ),
    );
    await request("/logout", "POST", {});
    assert.equal((await request("/session")).status, 401);
  } finally {
    server.close();
    await once(server, "close");
    store.db.close();
  }
});
test("cross-origin unauthenticated writes are rejected", async () => {
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const r = await fetch(
      `http://127.0.0.1:${(server.address() as any).port}/v1/auth/demo`,
      { method: "POST", headers: { Origin: "https://attacker.invalid" } },
    );
    assert.equal(r.status, 403);
  } finally {
    server.close();
    await once(server, "close");
    store.db.close();
  }
});
