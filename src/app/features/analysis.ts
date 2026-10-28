import { LedgerHistoryPanel } from "./history";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Empty, Source } from "../shared/ui";
import { sampleHistory } from "../shared/chart";
import { maxDrawdown } from "../domain/ledger";
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Empty, Source, LedgerHistoryPanel],
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">LOOK BEYOND THE BALANCE</span>
        <h1>Understand the bigger picture<span class="accent">.</span></h1>
        <p>
          Explore your allocation, your progress, and the context behind the
          numbers.
        </p>
      </div>
      <select
        aria-label="Analysis portfolio"
        [ngModel]="s.selected()"
        (ngModelChange)="s.select($event)"
      >
        <option value="all">All portfolios</option>
        @for (p of s.portfolios(); track p.id) {
          <option [value]="p.id">{{ p.name }}</option>
        }
      </select>
    </div>
    <div class="tabs">
      @for (t of tabs; track t) {
        <button
          [class.active]="tab() === t"
          (click)="tab.set(t)"
          [attr.aria-pressed]="tab() === t"
        >
          {{ t.charAt(0).toUpperCase() + t.slice(1) }}
        </button>
      }
    </div>
    @if (tab() === "value" || tab() === "returns") {
      <av-ledger-history />
    }
    @if (tab() === "allocation") {
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Every part of the whole</h2>
            <p>
              Current positions, including cash. Fund classifications do not
              imply look-through.
            </p>
          </div>
          <select aria-label="Allocation grouping" [(ngModel)]="group">
            <option value="class">Asset class</option>
            <option value="sector">Sector / fund category</option>
            <option value="geography">Geography</option>
            <option value="currency">Currency</option>
          </select>
        </div>
        <div class="allocation-bars">
          @for (row of groups(); track row.name) {
            <div class="allocation-row">
              <div>
                <strong>{{ row.name }}</strong
                ><span
                  >{{ s.money(row.value) }} ·
                  {{ s.number(row.weight, 1) }}%</span
                >
              </div>
              <div class="bar-track"><i [style.width.%]="row.weight"></i></div>
            </div>
          } @empty {
            <av-empty
              title="No complete allocation yet"
              description="Add holdings and ensure all prices and currency rates are available."
            />
          }
        </div>
        <av-source
          text="Current sample quote snapshot · ETF fund-level classification · no constituent look-through"
        />
      </section>
    }
    @if (tab() === "contributions") {
      <section class="panel padded">
        <h2>What drove a day</h2>
        <p>
          Additive daily attribution requires aligned daily valuations, FX,
          fees, and cash flows. The opening sample snapshot alone is
          insufficient for this calculation.
        </p>
        <av-empty
          icon="chart"
          title="Daily attribution unavailable"
          description="Unrealized gains are available in Holdings. They are not daily portfolio contributions."
          ><a routerLink="/portfolios" class="button secondary"
            >View holdings</a
          ></av-empty
        >
      </section>
    }
    @if (tab() === "risk") {
      <div class="metric-grid">
        <section class="metric-card">
          <span>Largest holding</span
          ><strong>{{ s.number(largest(), 1) }}%</strong
          ><small>Of current value, including cash</small>
        </section>
        <section class="metric-card">
          <span>Top-five concentration</span
          ><strong>{{ s.number(topFive(), 1) }}%</strong
          ><small>Of current value, including cash</small>
        </section>
        <section class="metric-card">
          <span>Fixture drawdown</span
          ><strong class="negative">{{ s.percent(drawdown()) }}</strong
          ><small>Synthetic return index · Jan–Oct 2026</small>
        </section>
        <section class="metric-card">
          <span>Historical volatility</span
          ><strong class="unavailable-metric">Not enough data</strong
          ><small>At least 60 aligned daily returns required</small>
        </section>
      </div>
      <section class="panel padded">
        <h2>Risk is more than a score</h2>
        <p>
          Concentration describes where your portfolio is exposed. Drawdown
          measures the decline from a previous peak in the return index, without
          mistaking deposits for returns. Volatility describes past variability
          and does not predict future losses.
        </p>
        <p>
          The synthetic fixture has 11 sparse observations. It cannot support
          annualized daily volatility. No single risk score is assigned.
        </p>
      </section>
    } `,
})
export class AnalysisPage {
  s = inject(Store);
  route = inject(ActivatedRoute);
  tabs = ["value", "returns", "allocation", "contributions", "risk"];
  tab = signal(this.route.snapshot.queryParamMap.get("tab") || "value");
  group = "class";
  groups() {
    const v = this.s.valuation();
    if (!v?.value || +v.value <= 0) return [];
    const grouped: Record<string, number> = {};
    for (const h of v.holdings) {
      const key = (h.asset as any)[this.group] || "Unknown";
      grouped[key] = (grouped[key] || 0) + Number(h.value);
    }
    grouped["Cash"] = Number(v.cashValue);
    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value,
        weight: (value / Number(v.value)) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }
  largest() {
    const weights =
      this.s.valuation()?.holdings.map((h) => Number(h.weight)) || [];
    return weights.length ? Math.max(...weights) : null;
  }
  topFive() {
    return (
      this.s
        .valuation()
        ?.holdings.map((h) => Number(h.weight))
        .sort((a, b) => b - a)
        .slice(0, 5)
        .reduce((a, b) => a + b, 0) || 0
    );
  }
  drawdown() {
    return (
      Number(maxDrawdown(sampleHistory.map((p) => String(p.value / 119800)))) *
      100
    );
  }
}
