import { assets } from "./sample";
import { ClosingSnapshot } from "../src/app/domain/history";

// Only the two dated synthetic snapshots exist. Never backfill other dates with current prices.
export const sampleCloses: ClosingSnapshot[] = [
  {
    date: "2026-10-27",
    prices: Object.fromEntries(
      assets
        .filter((a) => a.previousPrice !== null)
        .map((a) => [a.id, a.previousPrice!]),
    ),
    fx: {},
    source:
      "Avenor synthetic closing fixture · 27 October 2026 · not market data",
  },
  {
    date: "2026-10-28",
    prices: Object.fromEntries(
      assets.filter((a) => a.price !== null).map((a) => [a.id, a.price!]),
    ),
    fx: {},
    source:
      "Avenor synthetic closing fixture · 28 October 2026 · not market data",
  },
];
