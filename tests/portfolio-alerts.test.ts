import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePortfolioAlerts, evaluateRule } from "../server/alerts";
import { newWorkspace } from "../server/sample";
import { AlertRule } from "../src/app/domain/models";
const rule = (kind: AlertRule["kind"] = "portfolio-drawdown"): AlertRule => ({
  id: "rule",
  kind,
  portfolioId: "p",
  assetId: "",
  currency: "USD",
  threshold: kind === "portfolio-drawdown" ? "5" : "1000",
  direction: "above",
  cadence: "recurring",
  paused: false,
  previous: kind === "portfolio-drawdown" ? null : "900",
  previousClose: null,
  lastFired: null,
  state: "",
});
test("portfolio values use a fixed currency and ignore stale, duplicate and out-of-order observations", () => {
  const w = newWorkspace();
  w.alerts.push(rule("portfolio-value"));
  evaluatePortfolioAlerts(w, "p", "1100", "EUR", "2025-01-01", "0", true);
  assert.equal(w.notifications.length, 0);
  evaluatePortfolioAlerts(w, "p", "1100", "USD", "2025-01-01", "0", false);
  assert.equal(w.notifications.length, 0);
  evaluatePortfolioAlerts(w, "p", "1100", "USD", "2025-01-02", "0", true);
  assert.equal(w.notifications.length, 1);
  evaluatePortfolioAlerts(w, "p", "900", "USD", "2025-01-01", "0", true);
  assert.equal(w.alerts[0].previous, "1100");
  assert.equal(w.notifications[0].portfolioId, "p");
  assert.equal(w.notifications[0].threshold, "1000");
  assert.equal(w.notifications[0].currency, "USD");
});
test("daily loss removes flows and needs a prior comparable metric before crossing", () => {
  const w = newWorkspace();
  w.alerts.push(rule());
  const observe = (v: string, d: number, flow = "0") =>
    evaluatePortfolioAlerts(
      w,
      "p",
      v,
      "USD",
      `2025-01-0${d}T00:00:00Z`,
      flow,
      true,
    );
  observe("1000", 1);
  observe("1500", 2, "500");
  assert.equal(w.alerts[0].previous, "0");
  assert.equal(w.notifications.length, 0);
  observe("1350", 3);
  assert.equal(w.notifications.length, 1);
  assert.equal(w.notifications[0].observedValue, "10");
});
test("daily loss restarts after missing/stale/gapped closes or a zero base", () => {
  for (const mode of ["stale", "gap", "zero"]) {
    const w = newWorkspace();
    w.alerts.push(rule());
    evaluatePortfolioAlerts(w, "p", "1000", "USD", "2025-01-01", "0", true);
    evaluatePortfolioAlerts(w, "p", "1000", "USD", "2025-01-02", "0", true);
    if (mode === "stale")
      evaluatePortfolioAlerts(w, "p", "0", "USD", "2025-01-03", "0", false);
    if (mode === "zero")
      evaluatePortfolioAlerts(w, "p", "0", "USD", "2025-01-03", "-1000", true);
    evaluatePortfolioAlerts(w, "p", "700", "USD", "2025-01-04", "0", true);
    assert.equal(w.notifications.length, 0, mode);
    assert.equal(w.alerts[0].previous, null, mode);
  }
});
test("notify now is explicit, deduplicated and deactivates once rules", () => {
  const w = newWorkspace(),
    r = rule("portfolio-value");
  r.previous = "1100";
  r.cadence = "once";
  w.alerts.push(r);
  evaluateRule(w, r, "1100", "2025-01-01", new Date("2025-01-01"));
  assert.equal(w.notifications.length, 0);
  evaluateRule(w, r, "1100", "2025-01-02", new Date("2025-01-02"), true);
  assert.equal(w.notifications.length, 1);
  assert.equal(r.paused, true);
  evaluateRule(w, r, "1100", "2025-01-02", new Date("2025-01-02"), true);
  assert.equal(w.notifications.length, 1);
});
