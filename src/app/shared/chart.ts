import { Component, input, signal, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";
export const sampleHistory = [
  { date: "2026-01-02", value: 119800 },
  { date: "2026-02-02", value: 120600 },
  { date: "2026-03-02", value: 118300 },
  { date: "2026-04-02", value: 121400 },
  { date: "2026-05-04", value: 122700 },
  { date: "2026-06-02", value: 120900 },
  { date: "2026-07-02", value: 122400 },
  { date: "2026-08-03", value: 123900 },
  { date: "2026-09-02", value: 122800 },
  { date: "2026-10-02", value: 124150 },
  { date: "2026-10-28", value: 125000 },
];
@Component({
  selector: "av-chart",
  standalone: true,
  imports: [FormsModule],
  template: ` <div class="chart" [class.small-chart]="compact()">
      <div class="chart-observation">
        <span>{{ points()[selected()]?.date }}</span
        ><strong>{{ format(points()[selected()]?.value || 0) }}</strong>
      </div>
      <svg
        viewBox="0 0 800 240"
        role="img"
        aria-label="Synthetic opening portfolio value history, January to October 2026. Accessible values follow in the data table."
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity=".16" />
            <stop
              offset="100%"
              stop-color="var(--accent)"
              stop-opacity=".005"
            />
          </linearGradient>
        </defs>
        @for (tick of [0, 1, 2, 3]; track tick) {
          <line
            x1="58"
            x2="785"
            [attr.y1]="20 + tick * 56"
            [attr.y2]="20 + tick * 56"
            stroke="var(--border)"
            stroke-dasharray="3 5"
          />
          <text
            x="0"
            [attr.y]="24 + tick * 56"
            fill="var(--muted)"
            font-size="11"
          >
            {{ returns() ? 6 - tick * 2 + "%" : "$" + (126 - tick * 3) + "k" }}
          </text>
        }
        <path [attr.d]="area()" fill="url(#areaGradient)" />
        <path
          [attr.d]="path()"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2.8"
          stroke-linejoin="round"
        />
        @for (p of points(); track p.date; let i = $index) {
          <circle
            [attr.cx]="x(i)"
            [attr.cy]="y(p.value)"
            [attr.r]="selected() === i ? 5 : 3"
            fill="var(--surface)"
            stroke="var(--accent)"
            stroke-width="2"
          />
        }
        @for (i of [0, 3, 6, 10]; track i) {
          <text
            [attr.x]="x(i)"
            y="231"
            text-anchor="middle"
            fill="var(--muted)"
            font-size="11"
          >
            {{
              [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Oct",
              ][i]
            }}
            {{ i === 10 ? "28" : "2026" }}
          </text>
        }</svg
      ><label class="chart-slider"
        >Inspect observation<input
          type="range"
          min="0"
          [max]="points().length - 1"
          [(ngModel)]="observation"
          (ngModelChange)="selected.set(+$event)"
          aria-label="Select chart observation"
      /></label>
    </div>
    <details class="chart-table">
      <summary>View chart data and methodology</summary>
      <p>
        Separate synthetic opening-portfolio fixture. No flows after the
        $119,800 opening deposit. Values are illustrative observations, not
        market history or a projection. Your later transaction changes are not
        included in this fixture.
      </p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="numeric">
                {{ returns() ? "Cumulative return" : "Portfolio value (USD)" }}
              </th>
            </tr>
          </thead>
          <tbody>
            @for (p of points(); track p.date) {
              <tr>
                <td>{{ p.date }}</td>
                <td class="numeric">{{ format(p.value) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>`,
})
export class Chart {
  compact = input(false);
  returns = input(false);
  selected = signal(10);
  observation = 10;
  points = computed(() =>
    sampleHistory.map((p) => ({
      ...p,
      value: this.returns() ? (p.value / 119800 - 1) * 100 : p.value,
    })),
  );
  x(i: number) {
    return 60 + i * 72;
  }
  y(value: number) {
    return this.returns()
      ? 188 - (value + 1) * 27
      : 188 - ((value - 117000) / 9000) * 168;
  }
  path() {
    return this.points()
      .map((p, i) => `${i ? "L" : "M"}${this.x(i)},${this.y(p.value)}`)
      .join(" ");
  }
  area() {
    return this.path() + " L780,200 L60,200 Z";
  }
  format(n: number) {
    return this.returns()
      ? n.toFixed(2) + "%"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n);
  }
}
