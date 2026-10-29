import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStore } from "../server/store";
import { createEmailDelivery } from "../server/email";

const settings = {
  origin: "https://avenor.example.test",
  resendApiKey: "test-only-key",
  from: "Avenor <accounts@example.test>",
};

test("email delivery persists across restarts, retries with a stable key, and erases delivered secrets", async () => {
  const directory = mkdtempSync(join(tmpdir(), "avenor-email-test-"));
  let store = createStore(join(directory, "outbox.sqlite"));
  let time = 100_000;
  const requests: { url: string; key: string; body: any }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({
      url: String(input),
      key: new Headers(init?.headers).get("Idempotency-Key")!,
      body: JSON.parse(String(init?.body)),
    });
    return new Response("{}", { status: requests.length === 1 ? 503 : 200 });
  };
  try {
    let delivery = createEmailDelivery(
      store,
      { ...settings, now: () => time },
      fetcher,
    );
    delivery.enqueue("user", "verify", "person@example.test");
    await delivery.processDue();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.resend.com/emails");
    assert.deepEqual(requests[0].body.to, ["person@example.test"]);
    assert.match(
      requests[0].body.text,
      /https:\/\/avenor.example.test\/auth\/verify\?token=/,
    );
    await delivery.processDue();
    assert.equal(requests.length, 1, "backoff prevents immediate retry");
    store.db.close();
    store = createStore(join(directory, "outbox.sqlite"));
    delivery = createEmailDelivery(
      store,
      { ...settings, now: () => time },
      fetcher,
    );
    time += 60_000;
    await Promise.all([delivery.processDue(), delivery.processDue()]);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].key, requests[1].key);
    assert.deepEqual(requests[0].body, requests[1].body);
    const row = store.db.prepare("SELECT * FROM email_outbox").get() as any;
    assert.equal(row.status, "sent");
    assert.equal(row.email, null);
    assert.equal(row.url, null);
    assert.equal(row.attempts, 2);
    await delivery.processDue();
    assert.equal(requests.length, 2);
    assert.equal(
      (store.db.prepare("SELECT count(*) AS n FROM tokens").get() as any).n,
      1,
    );
  } finally {
    store.db.close();
    assert.ok(directory.startsWith(join(tmpdir(), "avenor-email-test-")));
    rmSync(directory, { recursive: true });
  }
});

test("superseded, consumed and expired token emails cannot be sent", async () => {
  const store = createStore(":memory:");
  let time = 100_000;
  const sent: string[] = [];
  const delivery = createEmailDelivery(
    store,
    { ...settings, now: () => time },
    async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)).text);
      return new Response("{}");
    },
  );
  try {
    delivery.enqueue("user", "reset", "person@example.test");
    const old = store.db.prepare("SELECT * FROM email_outbox").get() as any;
    delivery.enqueue("user", "reset", "person@example.test");
    const replaced = store.db
      .prepare("SELECT * FROM email_outbox WHERE id=?")
      .get(old.id) as any;
    assert.equal(replaced.status, "cancelled");
    assert.equal(replaced.url, null);
    assert.equal(
      store.db.prepare("SELECT * FROM tokens WHERE hash=?").get(old.tokenHash),
      undefined,
    );
    await delivery.processDue();
    assert.equal(sent.length, 1);
    assert.ok(!sent[0].includes(old.url));
    delivery.enqueue("consumed", "verify", "person@example.test");
    store.db.prepare("DELETE FROM tokens WHERE userId='consumed'").run();
    delivery.enqueue("expired", "reset", "person@example.test");
    time += 30 * 60_000;
    await delivery.processDue();
    assert.equal(sent.length, 1);
    assert.equal(
      (
        store.db
          .prepare(
            "SELECT count(*) AS n FROM email_outbox WHERE url IS NOT NULL",
          )
          .get() as any
      ).n,
      0,
    );
  } finally {
    store.db.close();
  }
});

test("token replacement and queued email are atomic", () => {
  const store = createStore(":memory:");
  const delivery = createEmailDelivery(store, settings);
  try {
    delivery.enqueue("user", "reset", "person@example.test");
    const token = store.db.prepare("SELECT * FROM tokens").get();
    const job = store.db.prepare("SELECT * FROM email_outbox").get();
    store.db.exec(
      "CREATE TRIGGER reject_email BEFORE INSERT ON email_outbox BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
    );
    assert.throws(() =>
      delivery.enqueue("user", "reset", "person@example.test"),
    );
    assert.deepEqual(store.db.prepare("SELECT * FROM tokens").get(), token);
    assert.deepEqual(store.db.prepare("SELECT * FROM email_outbox").get(), job);
  } finally {
    store.db.close();
  }
});

test("permanent failures are bounded and webhook delivery preserves its adapter contract", async () => {
  const store = createStore(":memory:");
  let time = 100_000;
  let calls = 0;
  const delivery = createEmailDelivery(
    store,
    {
      origin: settings.origin,
      resendApiKey: "",
      webhookUrl: "https://mail.example.test/deliver",
      webhookSecret: "test-secret",
      now: () => time,
    },
    async (input, init) => {
      calls++;
      assert.equal(input, "https://mail.example.test/deliver");
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer test-secret",
      );
      assert.deepEqual(Object.keys(JSON.parse(String(init?.body))).sort(), [
        "email",
        "kind",
        "url",
      ]);
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      return new Response("provider details must not be stored", {
        status: 400,
      });
    },
  );
  try {
    delivery.enqueue("user", "verify", "person@example.test");
    for (let i = 0; i < 12; i++) {
      await delivery.processDue();
      time += Math.min(60_000 * 2 ** i, 5 * 60_000);
    }
    assert.equal(calls, 8);
    const row = store.db.prepare("SELECT * FROM email_outbox").get() as any;
    assert.equal(row.status, "failed");
    assert.equal(row.url, null);
    assert.equal(row.email, null);
  } finally {
    store.db.close();
  }
});

test("a crashed worker's lease is respected and its retry budget survives restart", async () => {
  const store = createStore(":memory:");
  let time = 100_000;
  let calls = 0;
  const delivery = createEmailDelivery(
    store,
    { ...settings, now: () => time },
    async () => {
      calls++;
      return new Response("{}");
    },
  );
  try {
    delivery.enqueue("user", "reset", "person@example.test");
    store.db
      .prepare("UPDATE email_outbox SET attempts=8,leaseUntil=?")
      .run(time + 30_000);
    await delivery.processDue();
    assert.equal(calls, 0);
    assert.equal(
      (store.db.prepare("SELECT status FROM email_outbox").get() as any).status,
      "pending",
    );
    time += 30_000;
    await delivery.processDue();
    assert.equal(calls, 0);
    const row = store.db.prepare("SELECT * FROM email_outbox").get() as any;
    assert.equal(row.status, "failed");
    assert.equal(row.url, null);
  } finally {
    store.db.close();
  }
});
