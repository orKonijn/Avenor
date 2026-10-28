import test from "node:test";
import assert from "node:assert/strict";
import { compareHoldings } from "../src/app/domain/holdings";
import { Holding } from "../src/app/domain/models";

test("holding sort preserves decimal precision and keeps unknown values last", () => {
  const h = (id: string, value: string | null) =>
    ({ assetId: id, asset: { symbol: id }, value }) as Holding;
  const rows = [
    h("unknown", null),
    h("larger", "100000000000000000.02"),
    h("smaller", "100000000000000000.01"),
    h("zero", "0"),
  ];
  assert.deepEqual(
    [...rows]
      .sort((a, b) => compareHoldings(a, b, "value", true))
      .map((h) => h.assetId),
    ["zero", "smaller", "larger", "unknown"],
  );
  assert.deepEqual(
    [...rows]
      .sort((a, b) => compareHoldings(a, b, "value", false))
      .map((h) => h.assetId),
    ["larger", "smaller", "zero", "unknown"],
  );
});
