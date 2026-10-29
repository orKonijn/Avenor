import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app";
import { createStore } from "../server/store";

test("preferences preserve legacy defaults and reject invalid or stale updates atomically", async () => {
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const demo = await fetch(base + "/auth/demo", { method: "POST" });
    const cookie = demo.headers.get("set-cookie")!.split(";")[0];
    const session = (await demo.json()).data;
    const initial = session.workspace.preferences;
    const request = async (body: any, key = crypto.randomUUID()) => {
      const r = await fetch(base + "/me/preferences", {
        method: "PATCH",
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
    const legacy = await request(initial);
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.data.result.density, "comfortable");
    const updated = {
      ...legacy.body.data.result,
      density: "compact",
      interests: ["Technology", "Technology"],
    };
    const key = crypto.randomUUID();
    const saved = await request(updated, key);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.data.result.interests, ["Technology"]);
    assert.equal((await request(updated, key)).status, 200);
    assert.equal(
      (await request({ ...initial, density: "comfortable" })).status,
      409,
    );
    const current = saved.body.data.result;
    for (const patch of [
      { density: "tiny" },
      { density: null },
      { interests: null },
      { interests: ["Unknown"] },
      { interests: [3] },
    ]) {
      assert.equal((await request({ ...current, ...patch })).status, 422);
      assert.deepEqual(store.workspace(session.user.id).preferences, current);
    }
    const { density, interests, ...oldClient } = current;
    const preserved = await request(oldClient);
    assert.equal(preserved.status, 200);
    assert.equal(preserved.body.data.result.density, "compact");
    assert.deepEqual(preserved.body.data.result.interests, ["Technology"]);
    const cleared = await request({
      ...preserved.body.data.result,
      interests: [],
    });
    assert.deepEqual(cleared.body.data.result.interests, []);
  } finally {
    server.close();
    store.db.close();
  }
});
