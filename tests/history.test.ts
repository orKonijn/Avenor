import test from "node:test";
import assert from "node:assert/strict";
import { ledgerHistory, ClosingSnapshot } from "../src/app/domain/history";
import { assets } from "../server/sample";
import { Transaction } from "../src/app/domain/models";

const tx = (
  type: Transaction["type"],
  day: number,
  quantity: string,
  price: string,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  portfolioId: "p",
  type,
  effectiveAt: `2025-01-0${day}T00:00:00Z`,
  quantity,
  price,
  fee: "0",
  currency: "USD",
  note: "",
  revision: 1,
  ...extra,
});
const close = (day: number, price = "100"): ClosingSnapshot => ({
  date: `2025-01-0${day}`,
  prices: { "msft-xnas": price },
  fx: {},
  source: "test fixture",
});
test("ledger history removes contributions, includes fees, and replays backdated corrections", () => {
  const rows = [
    tx("deposit", 1, "1", "1000"),
    tx("buy", 1, "5", "100", { assetId: "msft-xnas" }),
    tx("deposit", 2, "1", "500"),
    tx("fee", 2, "1", "10"),
  ];
  const result = ledgerHistory(
    rows,
    assets,
    [close(1), close(2, "110")],
    "2025-01-02",
    "2025-01-02",
    "USD",
    4,
  );
  assert.equal(result.beginningValue, "1000");
  assert.equal(result.endingValue, "1540");
  assert.equal(result.netFlow, "500");
  assert.equal(result.gain, "40");
  assert.equal(result.return, "0.04");
  assert.match(result.rows[0].warnings.join(" "), /Large net flow/);
  const corrected = ledgerHistory(
    rows.map((t) => (t.type === "fee" ? { ...t, price: "20" } : t)),
    assets,
    [close(1), close(2, "110")],
    "2025-01-02",
    "2025-01-02",
    "USD",
    5,
  );
  assert.equal(corrected.gain, "30");
  assert.equal(corrected.revision, 5);
});
test("missing closes suppress daily and linked returns without carrying current quotes forward", () => {
  const rows = [
    tx("deposit", 1, "1", "1000"),
    tx("buy", 1, "5", "100", { assetId: "msft-xnas" }),
  ];
  const h = ledgerHistory(
    rows,
    assets,
    [close(1), close(3, "110")],
    "2025-01-02",
    "2025-01-03",
    "USD",
    1,
  );
  assert.equal(h.rows[0].value, null);
  assert.equal(h.rows[1].dailyReturn, null);
  assert.equal(h.return, null);
  assert.equal(h.gain, "50");
  assert.match(h.rows[0].missing.join(" "), /MSFT/);
});
test("opening holdings are external capital even when basis is unknown", () => {
  const rows = [
    tx("deposit", 1, "1", "1000"),
    tx("opening", 2, "5", "0", { assetId: "msft-xnas", basisUnknown: true }),
  ];
  const h = ledgerHistory(
    rows,
    assets,
    [close(2)],
    "2025-01-02",
    "2025-01-02",
    "USD",
    1,
  );
  assert.equal(h.netFlow, "500");
  assert.equal(h.gain, "0");
  assert.equal(h.return, "0");
  const missing = ledgerHistory(
    rows,
    assets,
    [],
    "2025-01-02",
    "2025-01-02",
    "USD",
    1,
  );
  assert.equal(missing.netFlow, null);
  assert.equal(missing.gain, null);
});
test("cash-only history needs no quotes, FX gaps stay unavailable and withdrawals are neutral", () => {
  const rows = [tx("deposit", 1, "1", "1000"), tx("withdrawal", 2, "1", "100")];
  const h = ledgerHistory(
    rows,
    assets,
    [],
    "2025-01-02",
    "2025-01-02",
    "USD",
    1,
  );
  assert.equal(h.netFlow, "-100");
  assert.equal(h.return, "0");
  const foreign = ledgerHistory(
    rows,
    assets,
    [],
    "2025-01-02",
    "2025-01-02",
    "EUR",
    1,
  );
  assert.equal(foreign.beginningValue, null);
  assert.equal(foreign.netFlow, null);
  const fx = [1, 2].map((d) => ({ ...close(d), fx: { "USD/EUR": "0.9" } }));
  assert.equal(
    ledgerHistory(rows, assets, fx, "2025-01-02", "2025-01-02", "EUR", 1)
      .endingValue,
    "810",
  );
});
test("opening flow uses closing share units after same-day splits", () => {
  const rows = [
    tx("deposit", 1, "1", "1000"),
    tx("opening", 2, "10", "0", { assetId: "msft-xnas", basisUnknown: true }),
    tx("split", 2, "2", "0", {
      assetId: "msft-xnas",
      effectiveAt: "2025-01-02T12:00:00Z",
    }),
  ];
  const h = ledgerHistory(
    rows,
    assets,
    [close(2, "50")],
    "2025-01-02",
    "2025-01-02",
    "USD",
    1,
  );
  assert.equal(h.endingValue, "2000");
  assert.equal(h.netFlow, "1000");
  assert.equal(h.gain, "0");
  assert.equal(h.return, "0");
});
test("zero initial value and invalid ranges cannot manufacture a return", () => {
  const h = ledgerHistory(
    [tx("deposit", 2, "1", "100")],
    assets,
    [],
    "2025-01-02",
    "2025-01-02",
    "USD",
    1,
  );
  assert.equal(h.gain, "0");
  assert.equal(h.return, null);
  for (const [from, to] of [
    ["2025-02-30", "2025-03-01"],
    ["2025-01-02", "2025-01-01"],
    ["2020-01-01", "2025-01-01"],
  ])
    assert.throws(() => ledgerHistory([], assets, [], from, to, "USD", 0));
});
