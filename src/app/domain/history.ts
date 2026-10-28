import { Asset, Transaction } from "./models";
import {
  D,
  DomainError,
  valueLedger,
  dailyReturn,
  linkedReturn,
} from "./ledger";

export interface ClosingSnapshot {
  date: string;
  prices: Record<string, string>;
  fx: Record<string, string>;
  source: string;
}
export interface HistoryRow {
  date: string;
  value: string | null;
  flow: string | null;
  gain: string | null;
  dailyReturn: string | null;
  missing: string[];
  warnings: string[];
  source: string;
}
export interface LedgerHistory {
  from: string;
  to: string;
  currency: string;
  revision: number;
  beginningValue: string | null;
  endingValue: string | null;
  netFlow: string | null;
  gain: string | null;
  return: string | null;
  rows: HistoryRow[];
}
export function historyDates(from: string, to: string) {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (
    !valid(from) ||
    !valid(to) ||
    from > to ||
    to > new Date().toISOString().slice(0, 10)
  )
    throw new DomainError("Choose valid dates in order, no later than today.");
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (days > 366) throw new DomainError("Choose a period of at most 366 days.");
  return Array.from({ length: days + 1 }, (_, i) =>
    new Date(Date.parse(from) + (i - 1) * 86400000).toISOString().slice(0, 10),
  );
}
export function ledgerHistory(
  transactions: Transaction[],
  assets: Asset[],
  snapshots: ClosingSnapshot[],
  from: string,
  to: string,
  currency: string,
  revision: number,
): LedgerHistory {
  const dates = historyDates(from, to);
  const portfolios = [...new Set(transactions.map((t) => t.portfolioId))];
  const rows: HistoryRow[] = [];
  let previous: string | null = null;
  let beginningValue: string | null = null;
  for (const [index, date] of dates.entries()) {
    const snapshot = snapshots.find((s) => s.date === date);
    const priced = assets.map((a) => ({
      ...a,
      price: snapshot?.prices[a.id] ?? null,
    }));
    const missing: string[] = [],
      warnings: string[] = [];
    let value = D(0),
      flow = D(0),
      complete = true,
      flowComplete = true;
    const active = transactions
      .filter(
        (t) =>
          !t.voided &&
          new Date(t.effectiveAt).toISOString().slice(0, 10) <= date,
      )
      .sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt));
    for (const id of portfolios) {
      const valuation = valueLedger(
        active.filter((t) => t.portfolioId === id),
        priced,
        revision,
        currency,
        snapshot?.fx,
      );
      if (valuation.value === null) complete = false;
      else value = value.plus(valuation.value);
      missing.push(...valuation.missing);
    }
    for (const t of active.filter(
      (t) =>
        new Date(t.effectiveAt).toISOString().slice(0, 10) === date &&
        ["deposit", "withdrawal", "opening"].includes(t.type),
    )) {
      const fx =
        t.currency === currency
          ? "1"
          : snapshot?.fx[`${t.currency}/${currency}`];
      const price =
        t.type === "opening" ? snapshot?.prices[t.assetId!] : t.price;
      let closingQuantity = D(t.quantity);
      if (t.type === "opening") {
        for (const later of active.slice(active.indexOf(t) + 1)) {
          if (
            later.type === "split" &&
            later.portfolioId === t.portfolioId &&
            later.assetId === t.assetId &&
            new Date(later.effectiveAt).toISOString().slice(0, 10) === date
          )
            closingQuantity = closingQuantity.mul(later.quantity);
        }
      }
      if (!fx || price === undefined) {
        flowComplete = false;
        missing.push(
          t.type === "opening"
            ? "Opening holding flow valuation"
            : `Flow FX ${t.currency}/${currency}`,
        );
      } else
        flow = flow.plus(
          closingQuantity
            .mul(price)
            .mul(fx)
            .mul(t.type === "withdrawal" ? -1 : 1),
        );
    }
    const closing = complete ? value.toString() : null;
    const net = flowComplete ? flow.toString() : null;
    let daily =
      previous !== null && closing !== null && net !== null
        ? dailyReturn(previous, closing, net)
        : null;
    if (daily !== null && D(daily).lt(-1)) {
      daily = null;
      warnings.push("Flow timing produces a return below -100%; unavailable.");
    }
    if (
      previous !== null &&
      D(previous).gt(0) &&
      flowComplete &&
      flow.abs().div(previous).gte("0.1")
    )
      warnings.push("Large net flow: end-of-day timing is an estimate.");
    if (previous !== null && D(previous).lte(0))
      warnings.push("A positive previous close is required for a return.");
    if (index === 0) beginningValue = closing;
    else
      rows.push({
        date,
        value: closing,
        flow: net,
        gain:
          previous !== null && closing !== null && net !== null
            ? D(closing).minus(previous).minus(net).toString()
            : null,
        dailyReturn: daily,
        missing: [...new Set(missing)],
        warnings,
        source:
          snapshot?.source ||
          "No dated security or FX snapshot; cash reconstructed from the ledger",
      });
    previous = closing;
  }
  const netFlow = rows.every((r) => r.flow !== null)
    ? rows.reduce((s, r) => s.plus(r.flow!), D(0)).toString()
    : null;
  const endingValue = rows.at(-1)!.value;
  return {
    from,
    to,
    currency,
    revision,
    beginningValue,
    endingValue,
    netFlow,
    gain:
      beginningValue !== null && endingValue !== null && netFlow !== null
        ? D(endingValue).minus(beginningValue).minus(netFlow).toString()
        : null,
    return: rows.every((r) => r.dailyReturn !== null)
      ? linkedReturn(rows.map((r) => r.dailyReturn!))
      : null,
    rows,
  };
}
