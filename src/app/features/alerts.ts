import { Component, inject, signal } from "@angular/core";
import { FormsModule, ReactiveFormsModule, FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Icon, Empty } from "../shared/ui";
import { AlertRule } from "../domain/models";
@Component({
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, Icon, Empty],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">LESS CHECKING. MORE PERSPECTIVE.</span>
        <h1>Know when it matters<span class="accent">.</span></h1>
        <p>
          Watch an asset, a portfolio milestone, or a change between closing
          values.
        </p>
      </div>
      <a routerLink="/alerts/new" class="button primary"
        ><av-icon name="plus" />Create alert</a
      >
    </div>
    <div class="callout section-gap">
      <av-icon name="info" />
      <p>
        Sample observations are evaluated on the server. Continuous monitoring
        still requires licensed data and scheduled ingestion. Missing or stale
        valuations cannot trigger a rule.
      </p>
    </div>
    @if (creating()) {
      <section class="panel form-panel">
        <h2>{{ editId ? "Edit threshold" : "Create an alert" }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <label
              >Alert type<select formControlName="kind">
                <option value="price">Asset price</option>
                <option value="portfolio-value">Portfolio value</option>
                <option value="portfolio-drawdown">Portfolio daily loss</option>
              </select></label
            >
            @if (form.controls.kind.value === "price") {
              <label
                >Asset<select formControlName="assetId">
                  @for (a of s.assets(); track a.id) {
                    <option [value]="a.id">
                      {{ a.symbol }} · {{ a.name }}
                    </option>
                  }
                </select></label
              >
            } @else {
              <label
                >Portfolio<select formControlName="portfolioId">
                  <option value="">Choose a portfolio</option>
                  @for (p of s.portfolios(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select></label
              ><label
                >Fixed observation currency<select formControlName="currency">
                  @for (c of s.state()?.currencies; track c) {
                    <option>{{ c }}</option>
                  }
                </select></label
              >
            }
            @if (form.controls.kind.value !== "portfolio-drawdown") {
              <label
                >Condition<select formControlName="direction">
                  <option value="above">Rises above</option>
                  <option value="below">Falls below</option>
                </select></label
              >
            }
            <label
              >Threshold ({{
                form.controls.kind.value === "portfolio-drawdown"
                  ? "%"
                  : form.controls.currency.value
              }})<input
                formControlName="threshold"
                inputmode="decimal"
                required /></label
            ><label
              >Cadence<select formControlName="cadence">
                <option value="once">Once</option>
                <option value="recurring">Recurring · 24-hour cooldown</option>
              </select></label
            >
            @if (!editId && form.controls.kind.value !== "portfolio-drawdown") {
              <label class="check-label span-2"
                ><input type="checkbox" formControlName="notifyNow" />Notify now
                if the available sample snapshot already satisfies this
                condition</label
              >
            }
          </div>
          @if (form.controls.kind.value === "portfolio-drawdown") {
            <p class="callout section-gap">
              Daily loss = 1 − (closing value − net external flow) ÷ previous
              close. Deposits and withdrawals do not count as investment loss.
              This is a close-to-close measure, not peak-to-trough drawdown. Two
              closes establish the first metric; a later crossing triggers the
              rule. Sample close dates use UTC.
            </p>
          } @else {
            <p class="muted section-gap">
              Unless you choose Notify now, the rule needs a new crossing from
              the other side. The currency stays fixed when you change display
              preferences.
            </p>
          }
          <div class="form-actions">
            <a routerLink="/alerts" class="button secondary">Cancel</a
            ><button class="button primary" [disabled]="s.busy()">
              {{ editId ? "Save threshold" : "Create alert" }}
            </button>
          </div>
        </form>
      </section>
    }
    <section class="panel">
      <div class="panel-heading">
        <h2>Your rules</h2>
        <span class="badge">{{ s.workspace()?.alerts?.length }} / 100</span>
      </div>
      @for (a of s.workspace()?.alerts; track a.id) {
        <div class="alert-row">
          <span class="alert-icon"><av-icon name="bell" /></span>
          <div>
            <h3>{{ label(a) }}</h3>
            <p>{{ a.paused ? "Paused" : a.state }} · {{ a.cadence }}</p>
            <small class="muted"
              >{{ a.basis || "quote-price" }} · {{ a.currency || "USD" }}</small
            >
          </div>
          <div class="inline-controls">
            <button class="button secondary" (click)="pause(a)">
              {{ a.paused ? "Resume" : "Pause" }}</button
            ><a class="button text" [routerLink]="['/alerts', a.id, 'edit']"
              >Edit</a
            ><button class="button text danger" (click)="remove(a)">
              Delete
            </button>
          </div>
        </div>
      } @empty {
        <av-empty
          icon="bell"
          title="Quiet, by design"
          description="Create an alert for an investment or portfolio level you want to follow."
        />
      }
    </section>
    @if (s.user()?.demo && s.workspace()?.alerts?.length) {
      <details class="panel padded section-gap">
        <summary>Try a sample observation</summary>
        <p>
          These values test rules without changing your holdings or the
          displayed market snapshot.
        </p>
        <div class="inline-form">
          <label
            >Observation type<select [(ngModel)]="observationKind">
              <option value="price">Asset price</option>
              <option value="portfolio">Portfolio closing value</option>
            </select></label
          >
          @if (observationKind === "price") {
            <label
              >Asset<select [(ngModel)]="sampleAsset">
                @for (a of s.assets(); track a.id) {
                  <option [value]="a.id">{{ a.symbol }}</option>
                }
              </select></label
            ><label
              >Sample price (USD)<input
                [(ngModel)]="samplePrice"
                inputmode="decimal"
            /></label>
          } @else {
            <label
              >Portfolio<select [(ngModel)]="samplePortfolio">
                @for (p of s.portfolios(); track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select></label
            ><label
              >Observation currency<select [(ngModel)]="sampleCurrency">
                @for (c of s.state()?.currencies; track c) {
                  <option>{{ c }}</option>
                }
              </select></label
            ><label
              >Closing value<input
                [(ngModel)]="sampleValue"
                inputmode="decimal" /></label
            ><label
              >Close date (UTC)<input
                type="date"
                [(ngModel)]="sampleDate"
                [max]="today" /></label
            ><label
              >Net external flow<input
                [(ngModel)]="sampleFlow"
                inputmode="decimal"
              /><small>Positive deposits; negative withdrawals.</small></label
            >
          }
          <button
            class="button secondary"
            [disabled]="s.busy()"
            (click)="observe()"
          >
            Evaluate observation
          </button>
        </div>
      </details>
    }
  `,
})
export class AlertsPage {
  s = inject(Store);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  creating = signal(false);
  editId = "";
  today = new Date().toISOString().slice(0, 10);
  observationKind = "price";
  sampleAsset = "msft-xnas";
  samplePrice = "450";
  samplePortfolio = this.s.portfolios()[0]?.id || "";
  sampleCurrency = "USD";
  sampleValue = "125000";
  sampleFlow = "0";
  sampleDate = this.today;
  form = this.fb.nonNullable.group({
    kind: ["price"],
    assetId: ["msft-xnas"],
    portfolioId: [this.samplePortfolio],
    currency: ["USD"],
    direction: ["above"],
    threshold: [""],
    cadence: ["once"],
    notifyNow: [false],
  });
  constructor() {
    this.route.paramMap.subscribe((p) => {
      this.creating.set(
        this.router.url.includes("/new") || this.router.url.includes("/edit"),
      );
      this.editId = p.get("id") || "";
      if (this.editId) {
        const a = this.s.workspace()?.alerts.find((a) => a.id === this.editId);
        if (a) {
          this.form.patchValue({
            ...a,
            kind: a.kind || "price",
            currency: a.currency || "USD",
          });
          for (const key of [
            "kind",
            "assetId",
            "portfolioId",
            "currency",
            "direction",
            "cadence",
          ] as const)
            this.form.controls[key].disable();
        }
      } else
        this.form.controls.assetId.setValue(
          this.route.snapshot.queryParamMap.get("assetId") || "msft-xnas",
        );
    });
  }
  label(a: AlertRule) {
    const title =
      a.kind === "portfolio-value" || a.kind === "portfolio-drawdown"
        ? this.s.portfolios().find((p) => p.id === a.portfolioId)?.name ||
          "Archived portfolio"
        : this.s.asset(a.assetId)?.symbol;
    return a.kind === "portfolio-drawdown"
      ? `${title} daily loss exceeds ${a.threshold}%`
      : `${title} ${a.direction === "above" ? "rises above" : "falls below"} ${this.s.money(a.threshold, a.currency || "USD")}`;
  }
  async save() {
    const result = await this.s.mutate(
      this.editId ? "/alerts/" + this.editId : "/alerts",
      this.editId ? "PATCH" : "POST",
      this.editId
        ? { threshold: this.form.controls.threshold.value }
        : this.form.getRawValue(),
      this.editId ? "Alert updated" : "Alert created",
    );
    if (result) await this.router.navigateByUrl("/alerts");
  }
  async pause(a: AlertRule) {
    await this.s.mutate(
      "/alerts/" + a.id,
      "PATCH",
      { paused: !a.paused },
      a.paused ? "Alert resumed" : "Alert paused",
    );
  }
  async remove(a: AlertRule) {
    if (confirm("Delete this alert? Existing notifications are preserved."))
      await this.s.mutate("/alerts/" + a.id, "DELETE", {}, "Alert deleted");
  }
  async observe() {
    await this.s.mutate(
      this.observationKind === "price"
        ? "/demo/observations"
        : "/demo/portfolio-observations",
      "POST",
      this.observationKind === "price"
        ? { assetId: this.sampleAsset, value: this.samplePrice }
        : {
            portfolioId: this.samplePortfolio,
            value: this.sampleValue,
            currency: this.sampleCurrency,
            externalFlow: this.sampleFlow,
            observedAt: this.sampleDate + "T00:00:00.000Z",
          },
      "Sample observation evaluated. Check Notifications for any crossing.",
    );
  }
}
