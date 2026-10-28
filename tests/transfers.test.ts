import test from "node:test";
import assert from "node:assert/strict";
import { recordTransfer, voidTransfer } from "../server/transfers";
import { newWorkspace, assets } from "../server/sample";
import { replay } from "../src/app/domain/ledger";
import { ledgerHistory } from "../src/app/domain/history";
const workspace = () => {
  const w = newWorkspace(false);
  w.preferences.onboarding = 3;
  w.portfolios = [
    { id: "a", name: "A", currency: "USD", revision: 0, archived: false },
    { id: "b", name: "B", currency: "USD", revision: 0, archived: false },
  ];
  w.transactions = [
    {
      id: "deposit",
      portfolioId: "a",
      type: "deposit",
      effectiveAt: "2025-01-01T00:00:00Z",
      quantity: "1",
      price: "1000",
      fee: "0",
      currency: "USD",
      note: "",
      revision: 1,
    },
  ];
  return w;
};
const body = {
  sourcePortfolioId: "a",
  destinationPortfolioId: "b",
  sourceRevision: 0,
  destinationRevision: 0,
  currency: "USD",
  amount: "200",
  effectiveAt: "2025-01-02T00:00:00Z",
};
test("paired transfer balances reconcile and history treats only the aggregate as internal", () => {
  const w = workspace();
  const { id } = recordTransfer(w, body);
  assert.equal(w.transactions.filter((t) => t.transferId === id).length, 2);
  assert.equal(
    replay(w.transactions.filter((t) => t.portfolioId === "a")).cash["USD"],
    "800",
  );
  assert.equal(
    replay(w.transactions.filter((t) => t.portfolioId === "b")).cash["USD"],
    "200",
  );
  const aggregate = ledgerHistory(
    w.transactions,
    assets,
    [],
    "2025-01-02",
    "2025-01-02",
    "USD",
    1,
  );
  assert.equal(aggregate.netFlow, "0");
  assert.equal(aggregate.gain, "0");
  assert.equal(aggregate.return, "0");
  const single = ledgerHistory(
    w.transactions.filter((t) => t.portfolioId === "a"),
    assets,
    [],
    "2025-01-02",
    "2025-01-02",
    "USD",
    1,
  );
  assert.equal(single.netFlow, "-200");
  assert.equal(single.return, "0");
  const missingFx = ledgerHistory(
    w.transactions,
    assets,
    [],
    "2025-01-02",
    "2025-01-02",
    "EUR",
    1,
  );
  assert.equal(missingFx.netFlow, "0");
  assert.equal(missingFx.endingValue, null);
  voidTransfer(w, id, { sourceRevision: 1, destinationRevision: 1 });
  assert.ok(
    w.transactions.filter((t) => t.transferId === id).every((t) => t.voided),
  );
  assert.equal(w.audit.length, 4);
});
test("invalid, stale, archived, onboarding and insufficient-cash transfers leave both portfolios unchanged", () => {
  for (const patch of [
    { amount: "1001" },
    { sourceRevision: 1 },
    { destinationPortfolioId: "a" },
    { destinationPortfolioId: "foreign" },
    { amount: "-1" },
    { currency: "BAD" },
    { effectiveAt: "2099-01-01" },
  ]) {
    const w = workspace(),
      before = structuredClone(w);
    assert.throws(() => recordTransfer(w, { ...body, ...patch }));
    assert.deepEqual(w, before);
  }
  for (const mode of ["archive", "onboarding"]) {
    const w = workspace();
    if (mode === "archive") w.portfolios[1].archived = true;
    else {
      w.preferences.onboarding = 2;
      w.onboarding = { portfolioId: "b" };
    }
    assert.throws(() => recordTransfer(w, body));
  }
});
test("voiding cannot break later destination activity; backdated transfers validate later source activity", () => {
  const w = workspace();
  const { id } = recordTransfer(w, body);
  w.transactions.push({
    ...w.transactions[0],
    id: "spent",
    portfolioId: "b",
    type: "withdrawal",
    price: "200",
    effectiveAt: "2025-01-03T00:00:00Z",
  });
  const before = structuredClone(w);
  assert.throws(() =>
    voidTransfer(w, id, { sourceRevision: 1, destinationRevision: 1 }),
  );
  assert.deepEqual(w, before);
  const v = workspace();
  v.transactions.push({
    ...v.transactions[0],
    id: "later",
    type: "withdrawal",
    price: "900",
    effectiveAt: "2025-01-03T00:00:00Z",
  });
  assert.throws(() => recordTransfer(v, body));
});
