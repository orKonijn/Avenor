import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Empty } from "../shared/ui";

@Component({
  standalone: true,
  imports: [RouterLink, Empty],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">YOUR RECORDS, PRESERVED</span>
        <h1>
          {{ current()?.name || "Archived portfolios"
          }}<span class="accent">.</span>
        </h1>
        <p>
          Read-only transaction and audit history for portfolios you have
          closed.
        </p>
      </div>
      <a class="button secondary" routerLink="/portfolios">Active portfolios</a>
    </div>
    <div class="portfolio-cards">
      @for (p of archived(); track p.id) {
        <a
          class="portfolio-summary"
          [class.selected]="current()?.id === p.id"
          [routerLink]="['/portfolios/archived', p.id]"
        >
          <span>{{ p.name }}</span
          ><strong>Archived</strong
          ><small
            >{{ p.currency }} accounting · Revision {{ p.revision }}</small
          >
        </a>
      } @empty {
        <section class="panel">
          <av-empty
            title="No archived portfolios"
            description="Empty portfolios can be archived from their portfolio page. Their records stay available here."
          />
        </section>
      }
    </div>
    @if (id() && !current()) {
      <section class="panel">
        <av-empty
          title="Archived portfolio unavailable"
          description="This portfolio is not in your archived records."
        />
      </section>
    }
    @if (current()) {
      <div class="callout">
        <p>
          Archived portfolios are excluded from active totals. These records
          cannot be edited.
        </p>
      </div>
      <section class="panel">
        <div class="panel-heading">
          <h2>Recorded activity</h2>
          <span>{{ transactions().length }} records</span>
        </div>
        <div
          class="table-scroll"
          role="region"
          aria-label="Archived transactions"
          tabindex="0"
        >
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Asset / note</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              @for (t of transactions(); track t.id) {
                <tr [class.voided]="t.voided">
                  <td>{{ t.effectiveAt.slice(0, 10) }}</td>
                  <td>{{ t.type }}{{ t.voided ? " · voided" : "" }}</td>
                  <td>
                    {{ s.asset(t.assetId || "")?.symbol || t.currency
                    }}<small>{{ t.note }}</small>
                  </td>
                  <td>{{ s.number(t.quantity, 8) }}</td>
                  <td>
                    {{
                      t.basisUnknown
                        ? "Unknown basis"
                        : s.money(t.price, t.currency)
                    }}
                  </td>
                  <td>{{ s.money(t.fee, t.currency) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">No transactions were recorded.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel padded">
        <h2>Audit history</h2>
        @for (a of audit(); track a.id) {
          <details class="audit-entry">
            <summary>{{ a.at }} · {{ a.action }}</summary>
            <pre>{{ json(a) }}</pre>
          </details>
        } @empty {
          <p>No changes to show.</p>
        }
      </section>
    }
  `,
})
export class ArchivedPage {
  s = inject(Store);
  route = inject(ActivatedRoute);
  id = signal<string | null>(null);
  archived = computed(
    () => this.s.workspace()?.portfolios.filter((p) => p.archived) || [],
  );
  current = computed(() => this.archived().find((p) => p.id === this.id()));
  transactions = computed(() =>
    (this.s.workspace()?.transactions || [])
      .filter((t) => t.portfolioId === this.current()?.id)
      .sort(
        (a, b) =>
          Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) ||
          a.id.localeCompare(b.id),
      ),
  );
  audit = computed(() => {
    const ids = new Set(this.transactions().map((t) => t.id));
    return [...(this.s.workspace()?.audit || [])]
      .filter((a) => a.entityId === this.current()?.id || ids.has(a.entityId))
      .reverse();
  });
  constructor() {
    this.route.paramMap.subscribe((p) => this.id.set(p.get("id")));
  }
  json(value: unknown) {
    return JSON.stringify(value, null, 2);
  }
}
