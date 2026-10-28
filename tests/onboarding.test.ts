import test from "node:test";
import assert from "node:assert/strict";
import {
  completeOnboarding,
  normalizeOpeningDraft,
} from "../server/onboarding";
import { assets, newWorkspace } from "../server/sample";
import {
  aggregateValuations,
  replay,
  valueLedger,
} from "../src/app/domain/ledger";
import { Transaction } from "../src/app/domain/models";
const setup = () => {
  const w = newWorkspace();
  w.preferences.onboarding = 2;
  w.portfolios.push({
    id: "p",
    name: "Opening",
    currency: "USD",
    revision: 0,
    archived: false,
  });
  w.onboarding = { portfolioId: "p" };
  return w;
};
const draft = () => ({
  date: "2025-01-01",
  cash: "500",
  holdings: [
    {
      assetId: "msft-xnas",
      quantity: "10",
      price: "100",
      basisUnknown: false,
      acquiredAt: "2024-02-01",
    },
  ],
});
test("opening holdings have no cash debit and known basis reconciles", () => {
  const w = setup();
  completeOnboarding(w, draft(), assets);
  const v = valueLedger(w.transactions, assets, 1);
  assert.equal(v.cashValue, "500");
  assert.equal(v.holdings[0].basis, "1000");
  assert.equal(v.value, "4700");
  assert.equal(v.gain, "3200");
  assert.equal(w.preferences.onboarding, 3);
  assert.equal(w.audit.length, 2);
  assert.equal(
    w.transactions.find((t) => t.type === "opening")!.acquiredAt,
    "2024-02-01T00:00:00.000Z",
  );
  assert.throws(() => completeOnboarding(w, draft(), assets));
});
test("unknown basis values shares but suppresses gains and aggregate basis", () => {
  const w = setup(),
    d = draft();
  d.holdings[0].basisUnknown = true;
  completeOnboarding(w, d, assets);
  const v = valueLedger(w.transactions, assets, 1);
  assert.equal(v.value, "4700");
  assert.equal(v.basis, null);
  assert.equal(v.gain, null);
  assert.equal(v.holdings[0].averageCost, null);
  const aggregate = aggregateValuations([
    v,
    valueLedger(newWorkspace(true).transactions, assets, 1),
  ]);
  assert.equal(aggregate.basis, null);
  assert.equal(
    aggregate.holdings.find((h) => h.assetId === "msft-xnas")!.basis,
    null,
  );
  assert.equal(aggregate.value, "129700");
});
test("FIFO unknown-basis disposal suppresses realized gain; remaining known lots recover basis", () => {
  const w = setup(),
    d = draft();
  d.holdings[0].basisUnknown = true;
  completeOnboarding(w, d, assets);
  const base = {
    portfolioId: "p",
    assetId: "msft-xnas",
    currency: "USD",
    fee: "0",
    note: "",
    revision: 1,
  };
  w.transactions.push(
    {
      ...base,
      id: "buy",
      type: "buy",
      quantity: "2",
      price: "100",
      effectiveAt: "2025-01-02",
    } as Transaction,
    {
      ...base,
      id: "sell",
      type: "sell",
      quantity: "10",
      price: "110",
      effectiveAt: "2025-01-03",
    } as Transaction,
  );
  const v = valueLedger(w.transactions, assets, 2);
  assert.equal(v.holdings[0].quantity, "2");
  assert.equal(v.holdings[0].basis, "200");
  assert.equal(v.holdings[0].realized, null);
  assert.equal(v.holdings[0].gain, "640");
  assert.equal(v.cashValue, "1400");
});
test("unknown acquisition date is explicit and correcting an opening basis restores gains", () => {
  const w = setup(),
    d = draft();
  d.holdings[0].basisUnknown = true;
  (d.holdings[0] as any).acquiredAt = null;
  completeOnboarding(w, d, assets);
  const opening = w.transactions.find((t) => t.type === "opening")!;
  assert.equal(opening.acquiredAt, null);
  opening.basisUnknown = false;
  opening.price = "100";
  assert.equal(valueLedger(w.transactions, assets, 1).gain, "3200");
});
test("invalid, duplicate, future-acquired or oversize opening inputs are rejected", () => {
  for (const update of [
    (d) => (d.date = "2025-02-30"),
    (d) => (d.cash = "-1"),
    (d) => d.holdings.push({ ...d.holdings[0] }),
    (d) => (d.holdings[0].quantity = "0"),
    (d) => (d.holdings[0].acquiredAt = "2025-01-02"),
  ] as Array<(d: ReturnType<typeof draft>) => void>) {
    const w = setup(),
      d = draft();
    update(d);
    assert.throws(() => completeOnboarding(w, d, assets));
    assert.equal(w.transactions.length, 0);
  }
  assert.throws(() =>
    normalizeOpeningDraft({
      ...draft(),
      holdings: Array(501).fill(draft().holdings[0]),
    }),
  );
});
