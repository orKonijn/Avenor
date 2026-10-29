import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { validateRuntime, accountAllowed, demoEnabled } from "../server/config";
import { createApp } from "../server/app";
import { createStore } from "../server/store";

test("production startup fails closed without private account and provider configuration", () => {
  const env = {
    NODE_ENV: "production",
    ENABLE_LOCAL_ACCOUNTS: "true",
    APP_ORIGIN: "https://private.example",
    DATABASE_PATH: "/var/data/avenor.sqlite",
    PRIVATE_ACCOUNT_EMAILS: "owner@example.test",
    RESEND_API_KEY: "test-only",
    EMAIL_FROM: "app@example.test",
    TWELVE_DATA_API_KEY: "test-only",
    MARKET_DATA_USE: "personal",
  };
  assert.doesNotThrow(() => validateRuntime(env));
  for (const key of [
    "APP_ORIGIN",
    "DATABASE_PATH",
    "PRIVATE_ACCOUNT_EMAILS",
    "RESEND_API_KEY",
    "TWELVE_DATA_API_KEY",
    "MARKET_DATA_USE",
  ]) {
    assert.throws(() => validateRuntime({ ...env, [key]: "" }));
  }
  assert.throws(() =>
    validateRuntime({ ...env, APP_ORIGIN: "http://private.example" }),
  );
  assert.equal(demoEnabled(env), false);
  assert.equal(accountAllowed("other@example.test", env), false);
  assert.equal(accountAllowed("owner@example.test", env), true);
});

test("private registration queues verification, blocks outsiders and demo, and verifies a real account", async () => {
  const overrides = {
    ENABLE_LOCAL_ACCOUNTS: "true",
    ENABLE_DEMO: "false",
    PRIVATE_ACCOUNT_EMAILS: "owner@example.test",
    APP_ORIGIN: "https://private.example",
  };
  const previous = Object.fromEntries(
    Object.keys(overrides).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, overrides);
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  const post = async (path: string, body: unknown) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const registration = {
    name: "Owner",
    password: "private-test-password",
    terms: true,
  };
  try {
    for (let i = 0; i < 35; i++)
      assert.equal((await fetch(base + "/auth/config")).status, 200);
    assert.equal((await post("/auth/demo", {})).status, 403);
    const rejected = await post("/auth/register", {
      ...registration,
      email: "other@example.test",
    });
    const accepted = await post("/auth/register", {
      ...registration,
      email: "owner@example.test",
    });
    assert.equal(rejected.status, 200);
    assert.equal(accepted.status, 200);
    assert.equal(
      (await rejected.json()).data.message,
      (await accepted.json()).data.message,
    );
    assert.equal(
      (store.db.prepare("SELECT count(*) AS n FROM users").get() as any).n,
      1,
    );
    const job = store.db
      .prepare("SELECT url FROM email_outbox WHERE status='pending'")
      .get() as any;
    assert.ok(job.url.startsWith("https://private.example/auth/verify?"));
    const token = new URL(job.url).searchParams.get("token");
    assert.equal((await post("/auth/verify", { token })).status, 200);
    assert.equal((await post("/auth/verify", { token })).status, 422);
    const login = await post("/auth/login", {
      email: "owner@example.test",
      password: registration.password,
    });
    assert.equal(login.status, 200);
    const data = (await login.json()).data;
    assert.equal(data.user.demo, false);
    assert.equal(data.user.verified, true);
    assert.equal(data.workspace.portfolios.length, 0);
    assert.ok(data.assets.every((a: any) => a.price === null));
    assert.equal(data.themes.length, 0);
    process.env["PRIVATE_ACCOUNT_EMAILS"] = "replacement@example.test";
    const revoked = await fetch(base + "/session", {
      headers: { Cookie: login.headers.get("set-cookie")!.split(";")[0] },
    });
    assert.equal(revoked.status, 401);
    assert.match(revoked.headers.get("set-cookie")!, /avenor_session=;/);
    assert.equal(
      (store.db.prepare("SELECT count(*) AS n FROM sessions").get() as any).n,
      0,
    );
  } finally {
    server.close();
    store.db.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
