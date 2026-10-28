import Decimal from "decimal.js";
import { Asset, Position, Transaction, Valuation } from "./models";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export const D = (n: Decimal.Value) => new Decimal(n);
export class DomainError extends Error {
  constructor(
    message: string,
    public code = "VALIDATION",
    public status = 422,
  ) {
    super(message);
  }
}
export function decimal(
  value: unknown,
  label: string,
  positive = false,
): Decimal {
  if (typeof value !== "string" || !/^\d{1,18}(\.\d{1,8})?$/.test(value))
    throw new DomainError(
      `${label} must be a decimal with up to 8 decimal places.`,
    );
  const result = D(value);
  if (positive && result.lte(0))
    throw new DomainError(`${label} must be greater than zero.`);
  return result;
}
export function replay(transactions: Transaction[]) {
  const cash: Record<string, Decimal> = {};
  const positions: Record<string, Position> = {};
  function cashLeg(currency: string, amount: Decimal, date: string) {
    cash[currency] = (cash[currency] || D(0)).plus(amount);
    if (cash[currency].lt(0))
      throw new DomainError(
        `Insufficient ${currency} cash on ${date.slice(0, 10)}. This change would invalidate the ledger.`,
      );
  }
  const ordered = transactions.filter((t) => !t.voided);
  for (const t of ordered)
    if (
      typeof t.effectiveAt !== "string" ||
      !Number.isFinite(Date.parse(t.effectiveAt)) ||
      Date.parse(t.effectiveAt) > Date.now()
    )
      throw new DomainError("Choose a valid date that is not in the future.");
  for (const t of ordered.sort(
    (a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt),
  )) {
    if (
      ![
        "deposit",
        "withdrawal",
        "buy",
        "sell",
        "dividend",
        "fee",
        "fx",
        "split",
      ].includes(t.type)
    )
      throw new DomainError("Unsupported transaction type.");
    if (
      !Number.isFinite(Date.parse(t.effectiveAt)) ||
      Date.parse(t.effectiveAt) > Date.now()
    )
      throw new DomainError("Choose a valid date that is not in the future.");
    if (!["USD", "EUR", "GBP"].includes(t.currency))
      throw new DomainError("Unsupported transaction currency.");
    const quantity = decimal(t.quantity, "Quantity", true),
      price = decimal(t.price, "Price"),
      fee = decimal(t.fee, "Fee");
    if (t.type === "split" && (!price.isZero() || !fee.isZero()))
      throw new DomainError(
        "Split price and fee must be zero. Record any expense as a separate fee transaction.",
      );
    const amount = quantity.mul(price);
    if (["buy", "sell"].includes(t.type) && price.lte(0))
      throw new DomainError("Price must be greater than zero.");
    if (
      ["deposit", "withdrawal", "dividend", "fee", "fx"].includes(t.type) &&
      amount.lte(0)
    )
      throw new DomainError("Amount must be greater than zero.");
    if (t.type === "deposit" || t.type === "dividend")
      cashLeg(t.currency, amount.minus(fee), t.effectiveAt);
    else if (t.type === "withdrawal" || t.type === "fee")
      cashLeg(t.currency, amount.plus(fee).neg(), t.effectiveAt);
    else if (t.type === "fx") {
      if (
        !t.destinationCurrency ||
        t.destinationCurrency === t.currency ||
        !["USD", "EUR", "GBP"].includes(t.destinationCurrency)
      )
        throw new DomainError(
          "Choose a different supported destination currency.",
        );
      const rate = decimal(t.rate, "Execution rate", true);
      cashLeg(t.currency, amount.plus(fee).neg(), t.effectiveAt);
      cashLeg(t.destinationCurrency, amount.mul(rate), t.effectiveAt);
    } else {
      if (!t.assetId) throw new DomainError("Choose an asset.");
      const p = (positions[t.assetId] ||= {
        assetId: t.assetId,
        quantity: "0",
        basis: "0",
        realized: "0",
        lots: [],
      });
      if (t.type === "buy") {
        cashLeg(t.currency, amount.plus(fee).neg(), t.effectiveAt);
        p.lots.push({
          transactionId: t.id,
          quantity: quantity.toString(),
          basis: amount.plus(fee).toString(),
        });
      }
      if (t.type === "sell") {
        if (D(p.quantity).lt(quantity))
          throw new DomainError(
            `Insufficient shares on ${t.effectiveAt.slice(0, 10)}. A later transaction may depend on these shares.`,
          );
        let remaining = quantity,
          removed = D(0);
        for (const lot of p.lots) {
          const take = Decimal.min(remaining, lot.quantity);
          if (take.isZero()) continue;
          const basis = D(lot.basis).mul(take).div(lot.quantity);
          lot.quantity = D(lot.quantity).minus(take).toString();
          lot.basis = D(lot.basis).minus(basis).toString();
          removed = removed.plus(basis);
          remaining = remaining.minus(take);
        }
        p.realized = D(p.realized)
          .plus(amount.minus(fee).minus(removed))
          .toString();
        cashLeg(t.currency, amount.minus(fee), t.effectiveAt);
      }
      if (t.type === "split") {
        if (D(p.quantity).isZero())
          throw new DomainError("A split needs an existing position.");
        for (const lot of p.lots)
          lot.quantity = D(lot.quantity).mul(quantity).toString();
      }
      p.lots = p.lots.filter((l) => D(l.quantity).gt(0));
      p.quantity = p.lots
        .reduce((sum, l) => sum.plus(l.quantity), D(0))
        .toString();
      p.basis = p.lots.reduce((sum, l) => sum.plus(l.basis), D(0)).toString();
    }
  }
  return {
    cash: Object.fromEntries(
      Object.entries(cash).map(([k, v]) => [k, v.toString()]),
    ),
    positions: Object.values(positions),
  };
}
export function valueLedger(
  transactions: Transaction[],
  assets: Asset[],
  revision: number,
  currency = "USD",
  fx: Record<string, string> = {},
): Valuation {
  const ledger = replay(transactions),
    missing: string[] = [];
  let known = D(0),
    cashValue = D(0),
    basis = D(0),
    allBasis = true;
  const rate = (from: string) =>
    from === currency
      ? D(1)
      : fx[`${from}/${currency}`]
        ? D(fx[`${from}/${currency}`])
        : null;
  for (const [c, v] of Object.entries(ledger.cash)) {
    if (D(v).isZero()) continue;
    const r = rate(c);
    if (!r) missing.push(`FX ${c}/${currency}`);
    else cashValue = cashValue.plus(D(v).mul(r));
  }
  known = known.plus(cashValue);
  const holdings = ledger.positions
    .filter((p) => D(p.quantity).gt(0))
    .map((p) => {
      const asset = assets.find((a) => a.id === p.assetId);
      if (!asset) throw new DomainError("Unknown asset.");
      const r = rate(asset.currency);
      const value =
        asset.price !== null && r
          ? D(p.quantity).mul(asset.price).mul(r)
          : null;
      // Cross-currency basis needs transaction-date FX; current FX cannot substitute.
      const cost = asset.currency === currency ? D(p.basis) : null;
      if (!cost) allBasis = false;
      else basis = basis.plus(cost);
      if (value === null) missing.push(asset.symbol);
      else known = known.plus(value);
      return {
        ...p,
        asset,
        value: value?.toString() ?? null,
        gain: value && cost ? value.minus(cost).toString() : null,
        weight: null as string | null,
        averageCost: D(p.basis).div(p.quantity).toString(),
      };
    });
  const complete = missing.length === 0;
  for (const h of holdings)
    h.weight =
      complete && known.gt(0) && h.value !== null
        ? D(h.value).div(known).mul(100).toString()
        : null;
  return {
    holdings,
    cash: ledger.cash,
    cashValue: missing.some((x) => x.startsWith("FX"))
      ? null
      : cashValue.toString(),
    value: complete ? known.toString() : null,
    knownValue: known.toString(),
    basis: basis.toString(),
    gain:
      complete && allBasis
        ? holdings.reduce((s, h) => s.plus(h.gain || 0), D(0)).toString()
        : null,
    coverage: holdings.length
      ? holdings.filter((h) => h.value !== null).length / holdings.length
      : 1,
    missing,
    revision,
  };
}
export const periodGain = (start: string, end: string, flow: string) =>
  D(end).minus(start).minus(flow).toString();
export const dailyReturn = (start: string, end: string, flow: string) =>
  D(start).gt(0) ? D(end).minus(flow).div(start).minus(1).toString() : null;
export const linkedReturn = (returns: string[]) =>
  returns
    .reduce((v, r) => v.mul(D(r).plus(1)), D(1))
    .minus(1)
    .toString();
export function maxDrawdown(index: string[]) {
  let peak = D(0),
    worst = D(0);
  for (const n of index) {
    peak = Decimal.max(peak, n);
    if (peak.gt(0)) worst = Decimal.min(worst, D(n).div(peak).minus(1));
  }
  return worst.toString();
}
export function volatility(returns: string[]) {
  if (returns.length < 60) return null;
  const mean = returns.reduce((s, r) => s.plus(r), D(0)).div(returns.length);
  return returns
    .reduce((s, r) => s.plus(D(r).minus(mean).pow(2)), D(0))
    .div(returns.length - 1)
    .sqrt()
    .mul(D(252).sqrt())
    .toString();
}
export function aggregateValuations(values: Valuation[]): Valuation {
  const result: Valuation = {
    holdings: [],
    cash: {},
    cashValue: "0",
    value: "0",
    knownValue: "0",
    basis: "0",
    gain: "0",
    coverage: 1,
    missing: [],
    revision: Math.max(0, ...values.map((v) => v.revision)),
  };
  for (const v of values) {
    result.knownValue = D(result.knownValue).plus(v.knownValue).toString();
    result.basis = D(result.basis).plus(v.basis).toString();
    result.cashValue =
      result.cashValue !== null && v.cashValue !== null
        ? D(result.cashValue).plus(v.cashValue).toString()
        : null;
    result.gain =
      result.gain !== null && v.gain !== null
        ? D(result.gain).plus(v.gain).toString()
        : null;
    result.missing.push(...v.missing);
    for (const [c, n] of Object.entries(v.cash))
      result.cash[c] = D(result.cash[c] || 0)
        .plus(n)
        .toString();
    for (const h of v.holdings) {
      const old = result.holdings.find((p) => p.assetId === h.assetId);
      if (!old) {
        result.holdings.push({ ...h, lots: [...h.lots] });
        continue;
      }
      old.quantity = D(old.quantity).plus(h.quantity).toString();
      old.basis = D(old.basis).plus(h.basis).toString();
      old.realized = D(old.realized).plus(h.realized).toString();
      old.value =
        old.value !== null && h.value !== null
          ? D(old.value).plus(h.value).toString()
          : null;
      old.gain =
        old.gain !== null && h.gain !== null
          ? D(old.gain).plus(h.gain).toString()
          : null;
      old.lots.push(...h.lots);
      old.averageCost = D(old.basis).div(old.quantity).toString();
    }
  }
  result.value = values.every((v) => v.value !== null)
    ? result.knownValue
    : null;
  result.missing = [...new Set(result.missing)];
  result.coverage = result.holdings.length
    ? result.holdings.filter((h) => h.value !== null).length /
      result.holdings.length
    : 1;
  for (const h of result.holdings)
    h.weight =
      result.value !== null && D(result.value).gt(0) && h.value !== null
        ? D(h.value).div(result.value).mul(100).toString()
        : null;
  return result;
}
