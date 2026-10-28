import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/app";
import { createStore } from "../server/store";
test("onboarding drafts persist, reject conflicting edits, complete atomically and cannot duplicate opening holdings", async () => {
  const { app, store } = createApp(createStore(":memory:"));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const response = await fetch(base + "/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"empty":true}',
    });
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    let session = (await response.json()).data;
    const request = async (
      path: string,
      method = "GET",
      body?: unknown,
      key = crypto.randomUUID(),
    ) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrf,
          "Idempotency-Key": key,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, ...(await response.json()) };
    };
    assert.equal(session.workspace.transactions.length, 0);
    const prefs = await request("/me/preferences", "PATCH", {
      ...session.workspace.preferences,
      onboarding: 3,
      interests: ["Technology"],
    });
    assert.equal(prefs.data.workspace.preferences.onboarding, 1);
    const created = await request("/portfolios", "POST", {
      name: "My opening portfolio",
      currency: "USD",
      onboarding: true,
    });
    const id = created.data.result.id;
    const archive = await request(`/portfolios/${id}`, "PATCH", {
      revision: created.data.result.revision,
      archived: true,
    });
    assert.equal(archive.status, 422);
    const afterArchive = await request("/session");
    assert.equal(afterArchive.data.workspace.portfolios[0].archived, false);
    assert.equal(afterArchive.data.workspace.revision, created.data.workspace.revision);
    assert.equal(
      (
        await request(`/portfolios/${id}/transactions`, "POST", {
          revision: 0,
          type: "deposit",
          quantity: "1",
          price: "1",
          fee: "0",
          currency: "USD",
          effectiveAt: "2025-01-01",
        })
      ).status,
      422,
    );
    const draft = {
      date: "2025-01-01",
      cash: "100",
      holdings: [
        {
          assetId: "msft-xnas",
          quantity: "2",
          price: "",
          basisUnknown: true,
          acquiredAt: null,
        },
      ],
    };
    const saved = await request("/onboarding/holdings-draft", "PUT", {
      revision: created.data.workspace.revision,
      draft,
    });
    assert.equal(saved.status, 200);
    const refreshed = await request("/session");
    assert.deepEqual(refreshed.data.workspace.onboarding.draft, draft);
    assert.equal(
      (
        await request("/onboarding/holdings-draft", "PUT", {
          revision: created.data.workspace.revision,
          draft,
        })
      ).status,
      409,
    );
    const key = crypto.randomUUID(),
      body = { revision: saved.data.workspace.revision, draft };
    const finish = await request("/onboarding/complete", "POST", body, key);
    assert.equal(finish.status, 200);
    assert.equal(finish.data.valuations[id].value, "940");
    assert.equal(finish.data.valuations[id].gain, null);
    const replay = await request("/onboarding/complete", "POST", body, key);
    assert.equal(replay.data.workspace.transactions.length, 2);
    const opening = finish.data.workspace.transactions.find(
      (t: any) => t.type === "opening",
    );
    for (const acquiredAt of [123, false, {}, "not-a-date"]) {
      const invalid = await request(`/transactions/${opening.id}`, "PATCH", {
        ...opening,
        acquiredAt,
        revision: finish.data.workspace.portfolios[0].revision,
      });
      assert.equal(invalid.status, 422);
    }
    const corrected = await request(`/transactions/${opening.id}`, "PATCH", {
      ...opening,
      basisUnknown: false,
      price: "100",
      revision: finish.data.workspace.portfolios[0].revision,
    });
    assert.equal(corrected.status, 200);
    assert.equal(corrected.data.valuations[id].gain, "640");
    const alert = await request("/alerts", "POST", {
      kind: "portfolio-value",
      portfolioId: id,
      currency: "USD",
      direction: "above",
      threshold: "500",
      cadence: "once",
      notifyNow: true,
    });
    assert.equal(alert.status, 200);
    assert.equal(alert.data.workspace.notifications.length, 1);
    assert.equal(alert.data.workspace.notifications[0].portfolioId, id);
    const loss = await request("/alerts", "POST", {
      kind: "portfolio-drawdown",
      portfolioId: id,
      currency: "USD",
      direction: "above",
      threshold: "5",
      cadence: "once",
    });
    assert.equal(
      (
        await request(`/alerts/${loss.data.result.id}`, "PATCH", {
          threshold: "101",
        })
      ).status,
      422,
    );
    const foreign = await fetch(base + "/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const foreignSession = (await foreign.json()).data;
    const forbidden = await fetch(base + "/alerts", {
      method: "POST",
      headers: {
        Cookie: foreign.headers.get("set-cookie")!.split(";")[0],
        "Content-Type": "application/json",
        "X-CSRF-Token": foreignSession.csrf,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        kind: "portfolio-value",
        portfolioId: id,
        currency: "USD",
        direction: "above",
        threshold: "1",
        cadence: "once",
      }),
    });
    assert.equal(forbidden.status, 404);
  } finally {
    server.close();
    await once(server, "close");
    store.db.close();
  }
});
