import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHash, scryptSync } from "node:crypto";
import { createApp } from "../server/app";
import { createStore } from "../server/store";
import { newWorkspace } from "../server/sample";
test("reset is single-use, revokes sessions, and preserves pending verification", async () => {
  const store = createStore(":memory:");
  const password = "correct-password-for-test";
  const salt = "test-salt";
  store.db
    .prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)")
    .run(
      "user",
      "person@example.test",
      "Person",
      salt + ":" + scryptSync(password, salt, 64).toString("hex"),
      0,
      0,
      JSON.stringify(newWorkspace()),
    );
  const digest = (s: string) => createHash("sha256").update(s).digest("hex");
  store.db
    .prepare("INSERT INTO tokens VALUES (?,?,?,?)")
    .run(digest("reset-token"), "user", "reset", Date.now() + 60000);
  store.db
    .prepare("INSERT INTO tokens VALUES (?,?,?,?)")
    .run(digest("verify-token"), "user", "verify", Date.now() + 60000);
  store.db
    .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
    .run("old-session", "user", "csrf", Date.now() + 60000);
  const { app } = createApp(store);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1/auth`;
  const post = (route: string, data: unknown) =>
    fetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  try {
    assert.equal(
      (
        await post("/reset", {
          token: "reset-token",
          password: "a-new-strong-password",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("/reset", {
          token: "reset-token",
          password: "another-strong-password",
        })
      ).status,
      422,
    );
    assert.equal(
      (
        store.db
          .prepare("SELECT count(*) AS count FROM sessions WHERE userId=?")
          .get("user") as any
      ).count,
      0,
    );
    assert.equal(
      (await post("/verify", { token: "verify-token" })).status,
      200,
    );
    assert.equal(
      (await post("/verify", { token: "verify-token" })).status,
      422,
    );
    const r = await post("/login", {
      email: "person@example.test",
      password: "a-new-strong-password",
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).data.user.verified, true);
    const unknown = await post("/recover", { email: "unknown@example.test" }),
      known = await post("/recover", { email: "person@example.test" });
    assert.equal(
      (await unknown.json()).data.message,
      (await known.json()).data.message,
    );
  } finally {
    server.close();
    await once(server, "close");
    store.db.close();
  }
});
