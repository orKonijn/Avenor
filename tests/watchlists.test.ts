import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app";
import { createStore } from "../server/store";

test("watchlist revisions preserve concurrent edits, legacy lists, and idempotent retries", async () => {
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const demo = await fetch(base + "/auth/demo", { method: "POST" });
    const cookie = demo.headers.get("set-cookie")!.split(";")[0];
    const session = (await demo.json()).data;
    const request = async (
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
      return { status: r.status, body: await r.json() };
    };
    // Existing persisted lists predate revisions and must remain editable.
    const workspace = store.workspace(session.user.id);
    const legacy = workspace.watchlists[0];
    delete legacy.revision;
    store.save(session.user.id, workspace);
    const path = `/watchlists/${legacy.id}`;
    assert.equal(
      (await request(path, "PATCH", { name: "Missing revision" })).status,
      409,
    );
    const key = crypto.randomUUID();
    const first = await request(
      path,
      "PATCH",
      { name: "Latest research", revision: 0 },
      key,
    );
    assert.equal(first.status, 200);
    assert.equal(first.body.data.result.revision, 1);
    const staleItems = await request(path, "PATCH", { items: [], revision: 0 });
    assert.equal(staleItems.status, 409);
    assert.equal((await request(path, "DELETE", { revision: 0 })).status, 409);
    assert.deepEqual(
      store.workspace(session.user.id).watchlists[0].items,
      legacy.items,
    );
    const replay = await request(
      path,
      "PATCH",
      { name: "Latest research", revision: 0 },
      key,
    );
    assert.equal(replay.status, 200);
    assert.equal(store.workspace(session.user.id).watchlists[0].revision, 1);
    assert.equal(
      (await request(path, "PATCH", { items: [], revision: 1 })).status,
      200,
    );
    assert.equal(
      (await request(path, "PATCH", { name: "Older tab rename", revision: 1 }))
        .status,
      409,
    );
    const alerts = store.workspace(session.user.id).alerts;
    const deletionKey = crypto.randomUUID();
    assert.equal(
      (await request(path, "DELETE", { revision: 2 }, deletionKey)).status,
      200,
    );
    assert.equal(
      (await request(path, "DELETE", { revision: 2 }, deletionKey)).status,
      200,
    );
    assert.equal(
      (await request(path, "PATCH", { items: [], revision: 2 })).status,
      404,
    );
    assert.deepEqual(store.workspace(session.user.id).alerts, alerts);
    const created = await request("/watchlists", "POST", {
      name: "Fresh list",
    });
    assert.equal(created.body.data.result.revision, 0);
    const other = await fetch(base + "/auth/demo", { method: "POST" });
    const otherSession = (await other.json()).data;
    // Fixture IDs may coincide, so use the newly created owned-only ID in the other session.
    const denied = await fetch(
      base + `/watchlists/${created.body.data.result.id}`,
      {
        method: "DELETE",
        headers: {
          Cookie: other.headers.get("set-cookie")!.split(";")[0],
          "Content-Type": "application/json",
          "X-CSRF-Token": otherSession.csrf,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ revision: 0 }),
      },
    );
    assert.equal(denied.status, 404);
  } finally {
    server.close();
    store.db.close();
  }
});
