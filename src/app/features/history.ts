import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "../core/store";
import { LedgerHistory } from "../domain/history";

@Component({
  selector: "av-ledger-history",
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="panel padded">
      <h2>History from your ledger</h2>
      <p>
        Daily closing values and cash-flow-adjusted returns, recalculated from
        your recorded transactions.
      </p>
      <form class="inline-form" (ngSubmit)="load()">
        <label
          >From<input type="date" name="from" [(ngModel)]="from" required
        /></label>
        <label
          >To<input type="date" name="to" [(ngModel)]="to" required
        /></label>
        <button class="button primary" [disabled]="loading()">
          Apply dates
        </button>
      </form>
      <div class="callout">
        <p>
          {{
            s.user()?.demo
              ? "Sample closing snapshots exist only for 27–28 October 2026. Other dates may have gaps. These are synthetic prices, not historical market data."
              : "No licensed closing-price or FX history is connected. Cash-only history is available when no conversion is required."
          }}
          Dates use UTC; today is provisional. Aggregate history includes past
          activity in archived portfolios.
        </p>
      </div>
      @if (loading()) {
        <p role="status">Calculating ledger history…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
    </section>
    @if (data(); as h) {
      <div class="metric-grid section-gap">
        <section class="metric-card">
          <span>Beginning value</span
          ><strong>{{ s.money(h.beginningValue, h.currency) }}</strong
          ><small>Close before {{ h.from }}</small>
        </section>
        <section class="metric-card">
          <span>Ending value</span
          ><strong>{{ s.money(h.endingValue, h.currency) }}</strong
          ><small>{{ h.to }}</small>
        </section>
        <section class="metric-card">
          <span>Period gain</span
          ><strong>{{ s.money(h.gain, h.currency) }}</strong
          ><small>After external flows · net of recorded fees</small>
        </section>
        <section class="metric-card">
          <span>Daily TWR estimate</span
          ><strong>{{
            h.return === null ? "Unavailable" : s.percent(+h.return * 100)
          }}</strong
          ><small>Geometrically linked · end-of-day flow convention</small>
        </section>
      </div>
      <section class="panel padded section-gap">
        <h2>Daily closing value</h2>
        @if (values().length > 1) {
          <p>
            {{ s.money(min(), h.currency) }} –
            {{ s.money(max(), h.currency) }} · {{ h.from }} to {{ h.to }} · gaps
            are not connected
          </p>
          <svg
            viewBox="0 0 800 180"
            role="img"
            aria-label="Ledger closing values. Exact values and data gaps are listed in the following table."
            style="width:100%;max-height:240px"
          >
            <path
              [attr.d]="path()"
              fill="none"
              stroke="var(--accent)"
              stroke-width="3"
            />
            @for (row of h.rows; track row.date; let i = $index) {
              @if (row.value !== null) {
                <circle
                  [attr.cx]="x(i)"
                  [attr.cy]="y(+row.value)"
                  r="3"
                  fill="var(--accent)"
                />
              }
            }
          </svg>
        } @else {
          <p>
            {{
              values().length
                ? "One complete close is available; see its exact value below."
                : "No complete closing values in this period."
            }}
          </p>
        }
        <div
          class="table-scroll"
          role="region"
          aria-label="Daily ledger history"
          tabindex="0"
        >
          <table class="history-table">
            <thead>
              <tr>
                <th>Date (UTC)</th>
                <th>Closing value</th>
                <th>External flow</th>
                <th>Daily gain</th>
                <th>Daily return</th>
                <th>Data quality / source</th>
              </tr>
            </thead>
            <tbody>
              @for (r of h.rows; track r.date) {
                <tr>
                  <td>{{ r.date }}</td>
                  <td>{{ s.money(r.value, h.currency) }}</td>
                  <td>{{ s.money(r.flow, h.currency) }}</td>
                  <td>{{ s.money(r.gain, h.currency) }}</td>
                  <td>
                    {{
                      r.dailyReturn === null
                        ? "Unavailable"
                        : s.percent(+r.dailyReturn * 100)
                    }}
                  </td>
                  <td>
                    {{
                      r.missing.length
                        ? "Missing: " + r.missing.join(", ")
                        : "Complete valuation"
                    }}<small>{{ r.warnings.join(" ") }}</small
                    ><small>{{ r.source }}</small>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel padded section-gap">
        <h2>How to read this history</h2>
        <p>
          Net external flow: {{ s.money(h.netFlow, h.currency) }}. Deposits and
          opening shares add capital; withdrawals remove it. Opening shares use
          that day's closing value, regardless of known cost basis. Dividends
          and fees stay in investment performance.
        </p>
        <p>
          Daily return = (closing value − net external flow) ÷ previous close −
          1. Returns compound across every day in the selected range; missing
          values or a zero starting value prevent a full-period return. A
          monetary period gain can still be available when both endpoints and
          all flows are known.
        </p>
        <p>
          No historical prices are carried forward. Cash flows use dated closing
          FX under the end-of-day estimate. Matched interportfolio transfers and
          licensed total-return benchmarks are not yet supported. Ledger
          revision {{ h.revision }}.
        </p>
      </section>
    }
  `,
})
export class LedgerHistoryPanel {
  s = inject(Store);
  from = this.s.user()?.demo
    ? "2026-10-28"
    : new Date().toISOString().slice(0, 10);
  to = this.from;
  data = signal<LedgerHistory | null>(null);
  loading = signal(false);
  error = signal("");
  private sequence = 0;
  values = computed(
    () =>
      this.data()
        ?.rows.filter((r) => r.value !== null)
        .map((r) => Number(r.value)) || [],
  );
  min = computed(() => Math.min(...this.values()));
  max = computed(() => Math.max(...this.values()));
  constructor() {
    effect((cleanup) => {
      this.s.selected();
      this.s.workspace()?.revision;
      this.s.workspace()?.preferences.currency;
      void this.load();
      cleanup(() => {
        this.sequence++;
      });
    });
  }
  async load() {
    const sequence = ++this.sequence,
      owner = this.s.user()?.id;
    this.loading.set(true);
    this.error.set("");
    this.data.set(null);
    const query = new URLSearchParams({
      from: this.from,
      to: this.to,
      portfolioId: this.s.selected(),
      currency: this.s.workspace()?.preferences.currency || "USD",
    });
    try {
      const data = await this.s.request<LedgerHistory>("/history?" + query);
      if (sequence === this.sequence && owner === this.s.user()?.id)
        this.data.set(data);
    } catch (e) {
      if (sequence === this.sequence) this.error.set((e as Error).message);
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }
  x(i: number) {
    return 16 + (i * 768) / Math.max(1, (this.data()?.rows.length || 1) - 1);
  }
  y(v: number) {
    return 160 - ((v - this.min()) * 140) / (this.max() - this.min() || 1);
  }
  path() {
    let connected = false;
    return (this.data()?.rows || [])
      .map((r, i) => {
        if (r.value === null) {
          connected = false;
          return "";
        }
        const point = `${connected ? "L" : "M"}${this.x(i)},${this.y(+r.value)}`;
        connected = true;
        return point;
      })
      .join(" ");
  }
}
