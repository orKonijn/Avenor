import { randomUUID } from "node:crypto";
import { D } from "../src/app/domain/ledger";
import { Workspace } from "../src/app/domain/models";
export function evaluateAlerts(
  w: Workspace,
  assetId: string,
  value: string,
  observedAt: string,
  fresh: boolean,
  now = new Date(),
) {
  if (!fresh) return;
  for (const rule of w.alerts.filter(
    (a) => !a.paused && a.assetId === assetId,
  )) {
    const over = (n: string) =>
      rule.direction === "above"
        ? D(n).gt(rule.threshold)
        : D(n).lt(rule.threshold);
    const crossed =
      rule.previous !== null && !over(rule.previous) && over(value);
    const cooldown =
      !rule.lastFired ||
      now.getTime() - Date.parse(rule.lastFired) >= 86_400_000;
    rule.previous = value;
    if (crossed && cooldown) {
      rule.lastFired = now.toISOString();
      rule.state = "Triggered";
      if (rule.cadence === "once") rule.paused = true;
      const id = `${rule.id}:${observedAt}`;
      if (!w.notifications.some((n) => n.id === id))
        w.notifications.unshift({
          id,
          ruleId: rule.id,
          title: "Price threshold crossed",
          message: `${value} USD crossed ${rule.direction} ${rule.threshold} USD. Observation: ${observedAt}. Provider: sample fixture; no live feed.`,
          createdAt: now.toISOString(),
          readAt: null,
          assetId,
        });
    } else
      rule.state = over(value)
        ? "Condition satisfied · waiting for reset"
        : "Watching for a crossing";
  }
}
