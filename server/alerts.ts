import { D, decimal, DomainError } from "../src/app/domain/ledger";
import { AlertRule, Workspace } from "../src/app/domain/models";

function observationIsNew(rule: AlertRule, at: string) {
  return (
    Number.isFinite(Date.parse(at)) &&
    (!rule.lastObservedAt || Date.parse(at) > Date.parse(rule.lastObservedAt))
  );
}
export function evaluateRule(
  w: Workspace,
  rule: AlertRule,
  value: string,
  observedAt: string,
  now = new Date(),
  notifyNow = false,
) {
  if (rule.paused || !observationIsNew(rule, observedAt)) return;
  const satisfied = (n: string) =>
    rule.direction === "above"
      ? D(n).gt(rule.threshold)
      : D(n).lt(rule.threshold);
  const crossed =
    rule.previous !== null && !satisfied(rule.previous) && satisfied(value);
  const cooldown =
    !rule.lastFired || now.getTime() - Date.parse(rule.lastFired) >= 86_400_000;
  rule.previous = value;
  rule.lastObservedAt = observedAt;
  if ((crossed || (notifyNow && satisfied(value))) && cooldown) {
    rule.lastFired = now.toISOString();
    rule.state = "Triggered";
    if (rule.cadence === "once") rule.paused = true;
    const id = `${rule.id}:${rule.version || 1}:${observedAt}`;
    const kind = rule.kind || "price";
    const units = kind === "portfolio-drawdown" ? "%" : rule.currency || "USD";
    if (!w.notifications.some((n) => n.id === id))
      w.notifications.unshift({
        id,
        ruleId: rule.id,
        title:
          kind === "price"
            ? "Price threshold crossed"
            : kind === "portfolio-value"
              ? "Portfolio value threshold crossed"
              : "Portfolio daily-loss threshold crossed",
        message: `${value} ${units} ${notifyNow ? "satisfies" : "crossed"} ${rule.direction} ${rule.threshold} ${units}. Basis: ${rule.basis || "quote-price"}. Sample observation: ${observedAt}; no live feed.`,
        createdAt: now.toISOString(),
        readAt: null,
        assetId: rule.assetId,
        portfolioId: rule.portfolioId,
        observedValue: value,
        threshold: rule.threshold,
        observedAt,
        currency: rule.currency || "USD",
        provider: "Avenor synthetic fixture",
        delaySeconds: 0,
      });
  } else
    rule.state = satisfied(value)
      ? "Condition satisfied · waiting for reset"
      : "Watching for a crossing";
}
export function evaluateAlerts(
  w: Workspace,
  assetId: string,
  value: string,
  observedAt: string,
  fresh: boolean,
  now = new Date(),
) {
  decimal(value, "Observation", true);
  for (const rule of w.alerts.filter(
    (a) =>
      !a.paused && (a.kind || "price") === "price" && a.assetId === assetId,
  )) {
    if (!observationIsNew(rule, observedAt)) continue;
    if (!fresh) {
      rule.state = "Evaluation delayed · stale or missing quote";
      continue;
    }
    evaluateRule(w, rule, value, observedAt, now);
  }
}
export function evaluatePortfolioAlerts(
  w: Workspace,
  portfolioId: string,
  value: string,
  currency: string,
  observedAt: string,
  externalFlow: string,
  fresh: boolean,
  now = new Date(),
) {
  decimal(value, "Closing value");
  if (!/^-?\d{1,18}(\.\d{1,8})?$/.test(externalFlow))
    throw new DomainError("External flow must be a signed decimal.");
  for (const rule of w.alerts.filter(
    (a) =>
      !a.paused && a.portfolioId === portfolioId && a.currency === currency,
  )) {
    if (!observationIsNew(rule, observedAt)) continue;
    if (!fresh) {
      rule.state = "Evaluation delayed · stale or incomplete valuation";
      if (rule.kind === "portfolio-drawdown") {
        rule.previous = null;
        rule.previousClose = null;
        rule.lastObservedAt = observedAt;
      }
      continue;
    }
    if (rule.kind === "portfolio-value") {
      evaluateRule(w, rule, value, observedAt, now);
      continue;
    }
    if (rule.kind !== "portfolio-drawdown") continue;
    // One close per UTC fixture day. Production ingestion must align the portfolio's market closes.
    if (rule.lastObservedAt?.slice(0, 10) === observedAt.slice(0, 10)) continue;
    const dayGap = rule.lastObservedAt
      ? Date.parse(observedAt.slice(0, 10)) -
        Date.parse(rule.lastObservedAt.slice(0, 10))
      : null;
    const previous = dayGap === 86400000 ? rule.previousClose : null;
    rule.previousClose = value;
    if (previous == null || D(previous).lte(0)) {
      rule.previous = null;
      rule.lastObservedAt = observedAt;
      rule.state = "Collecting comparable closes";
      continue;
    }
    const loss = D(1)
      .minus(D(value).minus(externalFlow).div(previous))
      .mul(100)
      .toString();
    evaluateRule(w, rule, loss, observedAt, now);
  }
}
