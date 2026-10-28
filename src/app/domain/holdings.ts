import Decimal from "decimal.js";
import { Holding } from "./models";

export function compareHoldings(
  a: Holding,
  b: Holding,
  key: string,
  ascending: boolean,
) {
  const value = (h: Holding): string | null => {
    switch (key) {
      case "quantity":
        return h.quantity;
      case "averageCost":
        return h.averageCost;
      case "price":
        return h.asset.price;
      case "weight":
        return h.weight;
      case "gain":
        return h.gain;
      default:
        return h.value;
    }
  };
  const av = value(a),
    bv = value(b);
  // Missing values stay last in either direction; never coerce them to zero.
  if (av === null && bv !== null) return 1;
  if (av !== null && bv === null) return -1;
  const difference = av === null || bv === null ? 0 : new Decimal(av).cmp(bv);
  return (
    difference * (ascending ? 1 : -1) ||
    a.asset.symbol.localeCompare(b.asset.symbol) ||
    a.assetId.localeCompare(b.assetId)
  );
}
