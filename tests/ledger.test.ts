import test from "node:test";
import assert from "node:assert/strict";
import {
  D,
  replay,
  valueLedger,
  dailyReturn,
  linkedReturn,
  periodGain,
  maxDrawdown,
  volatility,
  aggregateValuations,
} from "../src/app/domain/ledger";
import { Transaction } from "../src/app/domain/models";
import { assets, newWorkspace } from "../server/sample";
const tx = (
  type: Transaction["type"],
  quantity: string,
  price: string,
  fee = "0",
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  portfolioId: "p",
  type,
  quantity,
  price,
  fee,
  currency: "USD",
  effectiveAt: "2025-01-01T00:00:00.000Z",
  assetId: "msft-xnas",
  note: "",
  revision: 1,
  ...extra,
});
test("cash-flow-neutral period gain and daily TWR fixtures", () => {
  for (const [start, end, flow, gain, r] of [
    ["100", "150", "50", "0", "0"],
    ["100", "160", "50", "10", "0.1"],
    ["100", "90", "-20", "10", "0.1"],
  ]) {
    assert.equal(periodGain(start, end, flow), gain);
    assert.equal(dailyReturn(start, end, flow), r);
  }
  assert.equal(dailyReturn("0", "100", "100"), null);
  assert.equal(linkedReturn(["0.1", "-0.1"]), "-0.01");
});
test("fee-inclusive FIFO sale, remaining basis, valuation and split", () => {
  const ledger = [
    tx("deposit", "1", "2000"),
    tx("buy", "10", "100", "10"),
    tx("sell", "4", "120", "4"),
  ];
  let p = replay(ledger).positions[0];
  assert.equal(p.quantity, "6");
  assert.equal(p.basis, "606");
  assert.equal(p.realized, "72");
  const quote = assets.map((a) => ({
    ...a,
    price: a.id === "msft-xnas" ? "110" : a.price,
  }));
  const v = valueLedger(ledger, quote, 1);
  assert.equal(v.holdings[0].value, "660");
  assert.equal(v.holdings[0].gain, "54");
  ledger.push(tx("split", "2", "0"));
  p = replay(ledger).positions[0];
  assert.equal(p.quantity, "12");
  assert.equal(p.basis, "606");
  assert.equal(D(p.basis!).div(p.quantity).toString(), "50.5");
});
test("multiple FIFO lots allocate remaining basis correctly", () => {
  const p = replay([
    tx("deposit", "1", "5000"),
    tx("buy", "10", "100"),
    tx("buy", "10", "200"),
    tx("sell", "15", "250"),
  ]).positions[0];
  assert.equal(p.quantity, "5");
  assert.equal(p.basis, "1000");
  assert.equal(p.realized, "1750");
});
test("sample ledger reconciles exactly to the specification snapshot", () => {
  const w = newWorkspace(true);
  const v = valueLedger(w.transactions, assets, 1);
  assert.equal(v.value, "125000");
  assert.equal(v.cashValue, "4500");
  assert.equal(v.basis, "115300");
  assert.equal(v.gain, "5200");
  assert.equal(D(v.gain!).div(v.basis!).mul(100).toFixed(2), "4.51");
  assert.equal(
    v.holdings.reduce((s, h) => s.plus(h.value!), D(v.cashValue!)).toString(),
    v.value,
  );
});
test("backdated sales and voided deposits cannot invalidate later records", () => {
  const deposit = tx("deposit", "1", "5000"),
    buy = tx("buy", "10", "100");
  const later = tx("sell", "8", "110", "0", {
    effectiveAt: "2025-01-03T00:00:00.000Z",
  });
  assert.throws(
    () =>
      replay([
        deposit,
        buy,
        later,
        tx("sell", "4", "110", "0", {
          effectiveAt: "2025-01-02T00:00:00.000Z",
        }),
      ]),
    /Insufficient shares/,
  );
  assert.throws(
    () => replay([{ ...deposit, voided: true }, buy]),
    /Insufficient USD cash/,
  );
});
test("FX uses paired actual currency cash legs; missing display FX stays missing", () => {
  const ledger = [
    tx("deposit", "1", "100"),
    tx("fx", "1", "50", "2", { destinationCurrency: "EUR", rate: "0.9" }),
  ];
  assert.deepEqual(replay(ledger).cash, { USD: "48", EUR: "45" });
  const v = valueLedger(ledger, assets, 1);
  assert.equal(v.value, null);
  assert.equal(v.knownValue, "48");
  assert.ok(v.missing.includes("FX EUR/USD"));
  assert.equal(D(100).mul("1.2").minus(D(100).mul("1.1")).toString(), "10");
});
test("missing quote never becomes zero and gain is suppressed", () => {
  const w = newWorkspace(true);
  const v = valueLedger(
    w.transactions,
    assets.map((a) => (a.id === "msft-xnas" ? { ...a, price: null } : a)),
    1,
  );
  assert.equal(v.value, null);
  assert.equal(v.gain, null);
  assert.equal(v.coverage, 0.75);
  assert.equal(v.holdings.find((h) => h.assetId === "msft-xnas")!.value, null);
});
test("decimal precision, negative balances, future dates, and malformed inputs", () => {
  assert.equal(
    replay([
      tx("deposit", "1", "0.3"),
      tx("withdrawal", "1", "0.1"),
      tx("withdrawal", "1", "0.2"),
    ]).cash["USD"],
    "0",
  );
  assert.throws(
    () => replay([tx("deposit", "1", "1"), tx("withdrawal", "1", "2")]),
    /Insufficient/,
  );
  assert.throws(
    () => replay([tx("deposit", "1", "1", "0", { effectiveAt: "2999-01-01" })]),
    /future/,
  );
  for (const n of ["NaN", "Infinity", "-1", "1e4", "1.123456789"])
    assert.throws(() => replay([tx("deposit", "1", n)]));
});
test("drawdown is peak-relative and volatility needs enough observations", () => {
  assert.equal(maxDrawdown(["100", "110", "88", "99"]), "-0.2");
  assert.equal(volatility(Array(59).fill("0")), null);
  assert.equal(volatility(Array(60).fill("0")), "0");
});
test("offset timestamps validate chronological cash availability, not lexical order", () => {
  assert.throws(
    () =>
      replay([
        tx("deposit", "1", "100", "0", {
          effectiveAt: "2025-01-01T00:00:00-12:00",
        }),
        tx("withdrawal", "1", "100", "0", {
          effectiveAt: "2025-01-01T01:00:00Z",
        }),
      ]),
    /Insufficient/,
  );
});
test("split expenses cannot silently disappear", () => {
  assert.throws(
    () =>
      replay([
        tx("deposit", "1", "1000"),
        tx("buy", "1", "100"),
        tx("split", "2", "0", "10"),
      ]),
    /Split price and fee must be zero/,
  );
});
test("aggregate combines shared securities and decimal cash without changing individual accounts", () => {
  const a = valueLedger(
    [tx("deposit", "1", "1000.1"), tx("buy", "1", "100")],
    assets,
    1,
  );
  const b = valueLedger(
    [tx("deposit", "1", "1000.2"), tx("buy", "2", "100")],
    assets,
    2,
  );
  const total = aggregateValuations([a, b]);
  assert.equal(total.holdings.length, 1);
  assert.equal(total.holdings[0].quantity, "3");
  assert.equal(total.holdings[0].value, "1260");
  assert.equal(total.cashValue, "1700.3");
  assert.equal(total.value, "2960.3");
  assert.equal(total.holdings[0].basis, "300");
  assert.equal(a.holdings[0].quantity, "1");
});
