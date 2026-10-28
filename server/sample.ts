import { randomUUID } from "node:crypto";
import { Asset, Theme, Workspace, Transaction } from "../src/app/domain/models";
export const AS_OF = "2026-10-28T16:00:00.000Z";
export const assets: Asset[] = [
  {
    id: "msft-xnas",
    symbol: "MSFT",
    name: "Microsoft",
    exchange: "NASDAQ",
    currency: "USD",
    class: "Equity",
    sector: "Technology",
    geography: "United States",
    price: "420",
    previousPrice: "408",
    asOf: AS_OF,
    color: "#5145cd",
    description:
      "Software, cloud infrastructure, and productivity tools for people and organizations.",
  },
  {
    id: "vti-arcx",
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    exchange: "NYSE Arca",
    currency: "USD",
    class: "ETF",
    sector: "Fund · broad market",
    geography: "United States",
    price: "250",
    previousPrice: "250",
    asOf: AS_OF,
    color: "#087f8c",
    description:
      "A broad US equity fund. Fund-level classification; constituent look-through is unavailable.",
  },
  {
    id: "vxus-xnas",
    symbol: "VXUS",
    name: "Vanguard Total International Stock ETF",
    exchange: "NASDAQ",
    currency: "USD",
    class: "ETF",
    sector: "Fund · international",
    geography: "International",
    price: "60",
    previousPrice: "61",
    asOf: AS_OF,
    color: "#b185cd",
    description:
      "International equities across developed and emerging markets, represented at the fund level.",
  },
  {
    id: "bnd-xnas",
    symbol: "BND",
    name: "Vanguard Total Bond Market ETF",
    exchange: "NASDAQ",
    currency: "USD",
    class: "ETF",
    sector: "Fund · fixed income",
    geography: "United States",
    price: "70",
    previousPrice: "70.33333333333333333333333333333333333333",
    asOf: AS_OF,
    color: "#c59345",
    description:
      "Broad US investment-grade bond exposure. This is a fund classification, not constituent analysis.",
  },
  {
    id: "nvda-xnas",
    symbol: "NVDA",
    name: "NVIDIA",
    exchange: "NASDAQ",
    currency: "USD",
    class: "Equity",
    sector: "Technology",
    geography: "United States",
    price: "145",
    previousPrice: "142",
    asOf: AS_OF,
    color: "#418655",
    description:
      "Computing platforms, graphics processors, and accelerated infrastructure.",
  },
  {
    id: "aapl-xnas",
    symbol: "AAPL",
    name: "Apple",
    exchange: "NASDAQ",
    currency: "USD",
    class: "Equity",
    sector: "Technology",
    geography: "United States",
    price: "230",
    previousPrice: "232",
    asOf: AS_OF,
    color: "#65728c",
    description: "Consumer devices, software, and services.",
  },
];
export const themes: Theme[] = [
  {
    id: "intelligent-infrastructure",
    name: "Intelligent infrastructure",
    sector: "Technology",
    description: "The computing foundations of an AI-enabled world.",
    assets: ["msft-xnas", "nvda-xnas"],
    color: "#7b6bd6",
    thesis:
      "Investment in cloud and accelerated computing may expand the infrastructure used by businesses.",
    counterpoint:
      "High capital costs, competition, energy constraints, and uncertain monetization can limit returns.",
  },
  {
    id: "a-world-of-opportunity",
    name: "A world of opportunity",
    sector: "Diversification",
    description: "Look beyond borders. See a broader investment picture.",
    assets: ["vxus-xnas", "vti-arcx"],
    color: "#3c8e89",
    thesis:
      "International exposure can diversify regional economic and currency drivers.",
    counterpoint:
      "Currency movements and correlated downturns can reduce diversification benefits.",
  },
  {
    id: "steady-foundations",
    name: "Steady foundations",
    sector: "Fixed income",
    description: "Explore the role of bonds in a long-term portfolio.",
    assets: ["bnd-xnas"],
    color: "#b58b50",
    thesis:
      "High-quality bonds may provide income and diversify equity exposure.",
    counterpoint:
      "Interest-rate changes, inflation, and credit conditions can all cause losses.",
  },
];
export function newWorkspace(sample = false): Workspace {
  const workspace: Workspace = {
    revision: 0,
    portfolios: [],
    transactions: [],
    watchlists: [],
    alerts: [],
    notifications: [],
    audit: [],
    followedThemes: [],
    preferences: {
      appearance: "system",
      currency: "USD",
      locale: "en-US",
      timeZone: "UTC",
      interests: [],
      onboarding: sample ? 3 : 0,
      revision: 0,
    },
  };
  if (!sample) return workspace;
  workspace.portfolios.push({
    id: "long-term",
    name: "Long-term investments",
    currency: "USD",
    revision: 1,
    archived: false,
  });
  const rows: [Transaction["type"], string, string, string][] = [
    ["deposit", "", "1", "119800"],
    ["buy", "msft-xnas", "100", "380"],
    ["buy", "vti-arcx", "200", "235"],
    ["buy", "vxus-xnas", "300", "65"],
    ["buy", "bnd-xnas", "150", "72"],
  ];
  workspace.transactions = rows.map(([type, assetId, quantity, price], i) => ({
    id: randomUUID(),
    portfolioId: "long-term",
    type,
    assetId,
    quantity,
    price,
    fee: "0",
    currency: "USD",
    effectiveAt: `2026-01-02T09:0${i}:00.000Z`,
    note: "Isolated sample opening ledger",
    revision: 1,
  }));
  workspace.watchlists = [
    {
      id: randomUUID(),
      name: "On my radar",
      items: ["nvda-xnas", "aapl-xnas", "msft-xnas"],
    },
  ];
  workspace.followedThemes = ["intelligent-infrastructure"];
  return workspace;
}
