import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink, ActivatedRoute, Router } from "@angular/router";
import { Store } from "../core/store";
import { Icon, Source, Empty } from "../shared/ui";
import { Chart } from "../shared/chart";
@Component({
  standalone: true,
  imports: [RouterLink, FormsModule, Icon, Source, Empty, Chart],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">YOUR INVESTMENTS, IN PERSPECTIVE</div>
        <h1>
          A clearer view, {{ s.user()?.name?.split(" ")?.[0]
          }}<span class="accent">.</span>
        </h1>
        <p>Here’s where you stand. And what’s worth a closer look.</p>
      </div>
      <a routerLink="/transactions/new" class="button primary"
        ><av-icon name="plus" />Add transaction</a
      >
    </div>
    <div class="context-bar">
      <div class="inline-controls">
        <label class="sr-only" for="portfolio-select">Selected portfolio</label
        ><select
          id="portfolio-select"
          [ngModel]="s.selected()"
          (ngModelChange)="select($event)"
        >
          <option value="all">All portfolios</option>
          @for (p of s.portfolios(); track p.id) {
            <option [value]="p.id">{{ p.name }}</option>
          }</select
        ><span class="context-divider"></span
        ><span class="muted"
          >{{ s.workspace()?.preferences?.currency }}
          <span class="desktop-only">· Display currency</span></span
        >
      </div>
      <span class="data-pill"><i></i> Sample · 28 Oct 2026</span>
    </div>
    @if (s.valuation(); as v) {
      <div class="metric-grid">
        <a class="metric-card featured" routerLink="/portfolios"
          ><span>Total portfolio value <av-icon name="portfolio" /></span
          ><strong>{{ s.money(v.value) }}</strong
          ><small>{{
            v.missing.length
              ? "Incomplete · " + v.missing.join(", ")
              : "Your investments and cash, together"
          }}</small>
          <div class="metric-foot">
            <span
              >{{ s.portfolios().length }}
              {{
                s.portfolios().length === 1 ? "portfolio" : "portfolios"
              }}</span
            ><av-icon name="arrow" /></div></a
        ><a class="metric-card" routerLink="/analysis"
          ><span>Unrealized gain <av-icon name="up" /></span
          ><strong
            [class.positive]="+(v.gain || 0) >= 0"
            [class.negative]="+(v.gain || 0) < 0"
            >{{ +(v.gain || 0) > 0 ? "+" : "" }}{{ s.money(v.gain) }}</strong
          ><small
            ><b [class.positive]="+(v.gain || 0) >= 0">{{
              v.gain !== null && +v.basis > 0
                ? s.percent((+v.gain / +v.basis) * 100)
                : "—"
            }}</b>
            on remaining cost</small
          >
          <div class="metric-foot">
            <span>Net of recorded trade fees</span
            ><av-icon name="arrow" /></div></a
        ><a
          class="metric-card"
          routerLink="/analysis"
          [queryParams]="{ tab: 'allocation' }"
          ><span>Invested assets <av-icon name="chart" /></span
          ><strong>{{ v.holdings.length }}</strong
          ><small>Across {{ classes() }} asset classifications</small>
          <div class="metric-foot">
            <span>Explore your allocation</span
            ><av-icon name="arrow" /></div></a
        ><a class="metric-card" routerLink="/portfolios"
          ><span>Available cash <av-icon name="portfolio" /></span
          ><strong>{{ s.money(v.cashValue) }}</strong
          ><small>{{
            v.value && +v.value > 0 && v.cashValue !== null
              ? s.number((+v.cashValue / +v.value) * 100) +
                "% of your portfolio"
              : "Ready for your next step"
          }}</small>
          <div class="metric-foot">
            <span>From your recorded ledger</span><av-icon name="arrow" /></div
        ></a>
      </div>
      @if (v.holdings.length) {
        <div class="overview-main-grid">
          <section class="panel performance-panel">
            <div class="panel-heading">
              <div>
                <h2>The long view</h2>
                <p>A little distance brings a lot of perspective.</p>
              </div>
              <a routerLink="/analysis" class="text-link"
                >View analysis <av-icon name="arrow"
              /></a>
            </div>
            <div class="chart-toolbar">
              <div class="segmented">
                <button
                  (click)="returnChart.set(false)"
                  [class.selected]="!returnChart()"
                  [attr.aria-pressed]="!returnChart()"
                >
                  Value</button
                ><button
                  (click)="returnChart.set(true)"
                  [class.selected]="returnChart()"
                  [attr.aria-pressed]="returnChart()"
                >
                  Return
                </button>
              </div>
              <span class="muted small">Opening sample · Jan–Oct 2026</span>
            </div>
            <av-chart [returns]="returnChart()" /><av-source
              text="Synthetic opening-portfolio fixture · USD · no live market history"
            />
          </section>
          <section class="panel allocation-panel">
            <div class="panel-heading">
              <div>
                <h2>A balanced perspective</h2>
                <p>Where your value is today.</p>
              </div>
            </div>
            <div class="donut" [style.background]="donut()">
              <div>
                <small>Total value</small><strong>{{ s.money(v.value) }}</strong
                ><span>{{ v.holdings.length }} positions</span>
              </div>
            </div>
            <div class="allocation-legend">
              @for (a of allocation(); track a.name) {
                <div>
                  <i [style.background]="a.color"></i><span>{{ a.name }}</span
                  ><strong>{{ s.number(a.weight, 1) }}%</strong>
                </div>
              }
            </div>
            <a
              routerLink="/analysis"
              [queryParams]="{ tab: 'allocation' }"
              class="panel-bottom-link"
              >Explore allocation <av-icon name="arrow"
            /></a>
          </section>
        </div>
        <div class="overview-bottom-grid">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h2>Your holdings</h2>
                <p>A closer look at what you own.</p>
              </div>
              <a routerLink="/portfolios" class="text-link"
                >View all <av-icon name="arrow"
              /></a>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th class="numeric">Value</th>
                    <th class="numeric">Unrealized P/L</th>
                    <th class="numeric">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  @for (h of sortedHoldings(); track $index) {
                    <tr>
                      <td>
                        <a
                          class="asset-cell"
                          [routerLink]="['/assets', h.assetId]"
                          ><span
                            class="asset-symbol"
                            [style.--asset-color]="h.asset.color"
                            >{{ h.asset.symbol.slice(0, 1) }}</span
                          ><span
                            ><strong>{{ h.asset.symbol }}</strong
                            ><small>{{ h.asset.name }}</small></span
                          ></a
                        >
                      </td>
                      <td class="numeric">{{ s.money(h.value) }}</td>
                      <td
                        class="numeric"
                        [class.positive]="+(h.gain || 0) >= 0"
                        [class.negative]="+(h.gain || 0) < 0"
                      >
                        {{ +(h.gain || 0) > 0 ? "+" : "" }}{{ s.money(h.gain) }}
                      </td>
                      <td class="numeric muted">
                        {{ s.number(h.weight, 1) }}%
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <av-source />
          </section>
          <section class="panel perspective-panel">
            <span class="eyebrow">WORTH A CLOSER LOOK</span>
            <div class="perspective-symbol"><av-icon name="compass" /></div>
            <h2>Big ideas.<br />A wider perspective.</h2>
            <p>
              Explore the themes shaping industries, with context that goes
              beyond a headline.
            </p>
            <a routerLink="/discover" class="button secondary"
              >Find your next perspective <av-icon name="arrow"
            /></a>
            <div class="perspective-bottom">
              <span>Curated themes</span><span>Transparent methodology</span>
            </div>
          </section>
        </div>
      } @else {
        <section class="panel">
          <av-empty
            title="Your story starts here"
            description="Create a portfolio, record a deposit, then add your first investment."
            ><a routerLink="/portfolios/new" class="button primary"
              >Create portfolio</a
            ></av-empty
          >
        </section>
      }
      <section class="themes-section">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">LOOK A LITTLE FURTHER</span>
            <h2>Themes to explore</h2>
          </div>
          <a routerLink="/discover" class="text-link"
            >All themes <av-icon name="arrow"
          /></a>
        </div>
        <div class="theme-grid">
          @for (t of s.state()?.themes; track t.id) {
            <a class="theme-preview" [routerLink]="['/themes', t.id]"
              ><span class="theme-mini-art" [style.--theme-color]="t.color"
                ><i></i><i></i><i></i
                ><av-icon
                  [name]="
                    t.sector === 'Technology'
                      ? 'chart'
                      : t.sector === 'Fixed income'
                        ? 'shield'
                        : 'compass'
                  " /></span
              ><span
                ><small>{{ t.sector }}</small>
                <h3>{{ t.name }}</h3>
                <p>{{ t.description }}</p></span
              ><av-icon name="arrow"
            /></a>
          }
        </div>
      </section>
    }
  `,
})
export class OverviewPage {
  s = inject(Store);
  router = inject(Router);
  route = inject(ActivatedRoute);
  returnChart = signal(false);
  constructor() {
    const id = this.route.snapshot.queryParamMap.get("portfolioId");
    if (id && (id === "all" || this.s.portfolios().some((p) => p.id === id)))
      this.s.select(id);
  }
  select(id: string) {
    this.s.select(id);
    this.router.navigate([], {
      queryParams: { portfolioId: id },
      queryParamsHandling: "merge",
    });
  }
  classes() {
    return new Set(this.s.valuation()?.holdings.map((h) => h.asset.class)).size;
  }
  sortedHoldings() {
    return [...(this.s.valuation()?.holdings || [])]
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 5);
  }
  allocation() {
    const v = this.s.valuation();
    if (!v?.value || +v.value === 0) return [];
    const rows = [
      { name: "Equities", value: 0, color: "var(--accent)" },
      { name: "Funds", value: 0, color: "#087f8c" },
      { name: "Cash", value: Number(v.cashValue), color: "#c9cee1" },
    ];
    for (const h of v.holdings)
      rows[h.asset.class === "Equity" ? 0 : 1].value += Number(h.value);
    return rows.map((r) => ({
      ...r,
      weight: (r.value / Number(v.value)) * 100,
    }));
  }
  donut() {
    let n = 0;
    return (
      "conic-gradient(" +
      this.allocation()
        .map((r) => {
          const start = n;
          n += r.weight;
          return `${r.color} ${start}% ${n}%`;
        })
        .join(",") +
      ")"
    );
  }
}
