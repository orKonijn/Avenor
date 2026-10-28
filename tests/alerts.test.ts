import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAlerts } from "../server/alerts";
import { newWorkspace } from "../server/sample";
test("fresh crossings, stale suppression, deduplication, cooldown and reset", () => {
  const w = newWorkspace();
  w.alerts.push({
    id: "a",
    assetId: "msft-xnas",
    threshold: "100",
    direction: "above",
    cadence: "recurring",
    paused: false,
    previous: "90",
    lastFired: null,
    state: "",
  });
  const now = new Date("2025-01-01T00:00:00Z");
  evaluateAlerts(w, "msft-xnas", "110", now.toISOString(), false, now);
  assert.equal(w.notifications.length, 0);
  evaluateAlerts(w, "msft-xnas", "110", now.toISOString(), true, now);
  assert.equal(w.notifications.length, 1);
  evaluateAlerts(w, "msft-xnas", "120", now.toISOString(), true, now);
  assert.equal(w.notifications.length, 1);
  evaluateAlerts(w, "msft-xnas", "90", now.toISOString(), true, now);
  evaluateAlerts(w, "msft-xnas", "110", now.toISOString(), true, now);
  assert.equal(w.notifications.length, 1);
  const later = new Date("2025-01-03T00:00:00Z");
  evaluateAlerts(w, "msft-xnas", "90", later.toISOString(), true, later);
  evaluateAlerts(w, "msft-xnas", "110", later.toISOString(), true, later);
  assert.equal(w.notifications.length, 2);
});
test("once alert deactivates; newly satisfied condition waits for reset", () => {
  const w = newWorkspace();
  w.alerts.push({
    id: "a",
    assetId: "msft-xnas",
    threshold: "100",
    direction: "above",
    cadence: "once",
    paused: false,
    previous: "110",
    lastFired: null,
    state: "",
  });
  evaluateAlerts(w, "msft-xnas", "120", "2025-01-01", true);
  assert.equal(w.notifications.length, 0);
  evaluateAlerts(w, "msft-xnas", "90", "2025-01-02", true);
  evaluateAlerts(w, "msft-xnas", "110", "2025-01-03", true);
  assert.equal(w.notifications.length, 1);
  assert.equal(w.alerts[0].paused, true);
});
