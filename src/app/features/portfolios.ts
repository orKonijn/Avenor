import { Component, inject, signal, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Icon, Source, Empty } from "../shared/ui";
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, Source, Empty],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">A HOME FOR YOUR INVESTMENTS</span>
        <h1>
          {{ current()?.name || "Your portfolios"
          }}<span class="accent">.</span>
        </h1>
        <p>Every holding, every transaction. All in perspective.</p>
      </div>
      <div class="inline-controls">
        <button class="button secondary" (click)="creating.set(!creating())">
          <av-icon name="plus" />Create portfolio</button
        ><a
          class="button primary"
          routerLink="/transactions/new"
          [queryParams]="{ portfolioId: current()?.id }"
          ><av-icon name="plus" />Add transaction</a
        >
      </div>
    </div>
    @if (creating()) {
      <section class="panel form-panel">
        <h2>Create a portfolio</h2>
        <form (ngSubmit)="create()" class="inline-form">
          <label
            >Portfolio name<input
              [(ngModel)]="newName"
              name="name"
              required
              maxlength="60"
              placeholder="e.g. Long-term investments" /></label
          ><label
            >Accounting currency<select
              [(ngModel)]="newCurrency"
              name="currency"
            >
              @for (c of s.state()?.currencies; track c) {
                <option>{{ c }}</option>
              }
            </select></label
          ><button class="button primary" [disabled]="s.busy()">
            Create portfolio</button
          ><button
            type="button"
            class="button secondary"
            (click)="creating.set(false)"
          >
            Cancel
          </button>
        </form>
      </section>
    }
    <div class="portfolio-cards">
      @for (p of s.portfolios(); track p.id) {
        <button
          class="portfolio-summary"
          [class.selected]="s.selected() === p.id"
          (click)="select(p.id)"
        >
          <span><av-icon name="portfolio" />{{ p.name }}</span
          ><strong>{{ s.money(portfolioValue(p.id)) }}</strong
          ><small
            >{{ p.currency }} accounting · Ledger revision
            {{ p.revision }}</small
          >
        </button>
      } @empty {
        <section class="panel">
          <av-empty
            title="Make room for your goals"
            description="Create your first portfolio, then record an opening deposit."
          />
        </section>
      }
    </div>
    @if (s.portfolios().length) {
      <div class="tabs">
        <button
          [class.active]="tab() === 'holdings'"
          (click)="setTab('holdings')"
        >
          Holdings</button
        ><button
          [class.active]="tab() === 'transactions'"
          (click)="setTab('transactions')"
        >
          Transactions</button
        ><button [class.active]="tab() === 'audit'" (click)="setTab('audit')">
          Audit history
        </button>
        @if (current()) {
          <button (click)="rename()">Rename</button
          ><button (click)="archive()">Archive</button>
        }
      </div>
      @if (tab() === "holdings") {
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>What you own</h2>
              <p>
                {{ s.valuation()?.holdings?.length }} positions ·
                {{ s.number((s.valuation()?.coverage || 0) * 100) }}% quote
                coverage
              </p>
            </div>
            <div class="inline-controls">
              <label class="search-field"
                ><av-icon name="search" /><input
                  aria-label="Filter holdings"
                  placeholder="Find a holding…"
                  [ngModel]="query()"
                  (ngModelChange)="filter($event)" /></label
              ><select
                aria-label="Asset class"
                [ngModel]="assetClass()"
                (ngModelChange)="assetClass.set($event); saveFilters()"
              >
                <option value="">All classes</option>
                <option>Equity</option>
                <option>ETF</option></select
              ><select
                aria-label="Gain or loss"
                [ngModel]="gainFilter()"
                (ngModelChange)="gainFilter.set($event); saveFilters()"
              >
                <option value="">All results</option>
                <option value="gain">Gains</option>
                <option value="loss">Losses</option>
              </select>
            </div>
          </div>
          <div
            class="table-scroll"
            role="region"
            aria-label="Holdings table"
            tabindex="0"
          >
            <table class="holdings-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  @for (c of columns; track c.key) {
                    <th
                      class="numeric"
                      [attr.aria-sort]="
                        sort() === c.key
                          ? ascending()
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      "
                    >
                      <button (click)="sortBy(c.key)">
                        {{ c.label }}
                        {{ sort() === c.key ? (ascending() ? "↑" : "↓") : "" }}
                      </button>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (
                  h of filtered().slice(page() * 25, (page() + 1) * 25);
                  track $index
                ) {
                  <tr>
                    <td>
                      <a
                        class="asset-cell"
                        [routerLink]="
                          current()
                            ? [
                                '/portfolios',
                                current()!.id,
                                'holdings',
                                h.assetId,
                              ]
                            : ['/assets', h.assetId]
                        "
                        ><span
                          class="asset-symbol"
                          [style.--asset-color]="h.asset.color"
                          >{{ h.asset.symbol.slice(0, 1) }}</span
                        ><span
                          ><strong>{{ h.asset.symbol }}</strong
                          ><small>{{ h.asset.name }}</small
                          ><small
                            >{{ h.asset.exchange }} ·
                            {{ h.asset.currency }}</small
                          ></span
                        ></a
                      >
                    </td>
                    <td class="numeric">{{ s.number(h.quantity, 8) }}</td>
                    <td class="numeric">
                      {{ s.money(h.averageCost, h.asset.currency) }}
                    </td>
                    <td class="numeric">
                      {{ s.money(h.asset.price, h.asset.currency) }}
                    </td>
                    <td class="numeric">
                      <strong>{{ s.money(h.value) }}</strong>
                    </td>
                    <td class="numeric">{{ s.number(h.weight, 1) }}%</td>
                    <td
                      class="numeric"
                      [class.positive]="+(h.gain || 0) >= 0"
                      [class.negative]="+(h.gain || 0) < 0"
                    >
                      {{ +(h.gain || 0) > 0 ? "+" : "" }}{{ s.money(h.gain)
                      }}<small>{{
                        h.gain !== null && h.basis !== null && +h.basis > 0
                          ? s.percent((+h.gain / +h.basis) * 100)
                          : "Unavailable"
                      }}</small>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <av-empty
                        title="No matching holdings"
                        description="Try a different search or record your first transaction."
                        ><button
                          class="button secondary"
                          (click)="
                            query.set('');
                            assetClass.set('');
                            gainFilter.set('');
                            saveFilters()
                          "
                        >
                          Clear filters
                        </button></av-empty
                      >
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="mobile-holdings">
            @for (h of filtered(); track $index) {
              <details>
                <summary>
                  <span
                    ><strong>{{ h.asset.symbol }}</strong
                    ><small>{{ h.asset.name }}</small></span
                  ><strong>{{ s.money(h.value) }}</strong>
                </summary>
                <dl>
                  <dt>Quantity</dt>
                  <dd>{{ h.quantity }}</dd>
                  <dt>Average cost</dt>
                  <dd>{{ s.money(h.averageCost, h.asset.currency) }}</dd>
                  <dt>Price</dt>
                  <dd>{{ s.money(h.asset.price, h.asset.currency) }}</dd>
                  <dt>Weight</dt>
                  <dd>{{ s.number(h.weight) }}%</dd>
                  <dt>Unrealized gain</dt>
                  <dd>{{ s.money(h.gain) }}</dd>
                </dl>
                <a [routerLink]="['/assets', h.assetId]">View asset details</a>
              </details>
            }
          </div>
          <div class="table-footer">
            <span>{{ filtered().length }} holdings · 25 per page</span>
            <div>
              <button
                class="button secondary"
                [disabled]="page() === 0"
                (click)="page.set(page() - 1)"
              >
                Previous</button
              ><button
                class="button secondary"
                [disabled]="(page() + 1) * 25 >= filtered().length"
                (click)="page.set(page() + 1)"
              >
                Next
              </button>
            </div>
          </div>
          <av-source />
        </section>
        <section class="panel cash-panel">
          <h2>Cash balances</h2>
          <div class="cash-balances">
            @for (c of cashEntries(); track c[0]) {
              <div>
                <span>{{ c[0] }}</span
                ><strong>{{ s.money(c[1], c[0]) }}</strong>
              </div>
            } @empty {
              <p>No cash transactions recorded.</p>
            }
          </div>
        </section>
      }
      @if (tab() === "transactions") {
        <section class="panel">
          <div class="panel-heading">
            <h2>Recorded activity</h2>
            <select
              aria-label="Filter transaction type"
              [(ngModel)]="transactionType"
            >
              <option value="">All transactions</option>
              @for (type of types; track type) {
                <option>{{ type }}</option>
              }
            </select>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Asset / note</th>
                  <th class="numeric">Quantity × price</th>
                  <th class="numeric">Fee</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (t of transactionRows(); track t.id) {
                  <tr [class.voided]="t.voided">
                    <td>{{ t.effectiveAt.slice(0, 10) }}</td>
                    <td>
                      <span class="badge"
                        >{{ t.type }}{{ t.voided ? " · voided" : "" }}</span
                      >
                    </td>
                    <td>
                      <strong>{{
                        s.asset(t.assetId || "")?.symbol || t.currency
                      }}</strong
                      ><small>{{ t.note }}</small>
                    </td>
                    <td class="numeric">
                      {{ t.quantity }} × {{ s.money(t.price, t.currency) }}
                    </td>
                    <td class="numeric">{{ s.money(t.fee, t.currency) }}</td>
                    <td>
                      @if (!t.voided) {
                        <a
                          class="button text"
                          [routerLink]="['/transactions', t.id, 'edit']"
                          >Edit</a
                        ><button
                          class="button text danger"
                          (click)="voidTransaction(t.id, t.portfolioId)"
                        >
                          Void
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <av-empty
                        title="No transactions yet"
                        description="Start with a deposit to fund this portfolio."
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
      @if (tab() === "audit") {
        <section class="panel">
          <div class="panel-heading">
            <h2>Changes, with a paper trail</h2>
            <p>Server-recorded history cannot be edited.</p>
          </div>
          @for (a of auditRows(); track a.id) {
            <details class="audit-entry">
              <summary>
                {{ a.at }} · {{ a.action }} · {{ a.entityId.slice(0, 8) }}
              </summary>
              <pre>{{ json(a) }}</pre>
            </details>
          } @empty {
            <av-empty
              title="No changes to show"
              description="New, edited, and voided records will appear here."
            />
          }
        </section>
      }
    }
  `,
})
export class PortfoliosPage {
  s = inject(Store);
  route = inject(ActivatedRoute);
  router = inject(Router);
  creating = signal(false);
  newName = "";
  newCurrency = "USD";
  tab = signal("holdings");
  query = signal("");
  assetClass = signal("");
  gainFilter = signal("");
  sort = signal("value");
  ascending = signal(false);
  page = signal(0);
  transactionType = "";
  types = [
    "deposit",
    "withdrawal",
    "buy",
    "sell",
    "dividend",
    "fee",
    "fx",
    "split",
  ];
  columns = [
    { key: "quantity", label: "Quantity" },
    { key: "averageCost", label: "Avg. cost" },
    { key: "price", label: "Price" },
    { key: "value", label: "Market value" },
    { key: "weight", label: "Weight" },
    { key: "gain", label: "Unrealized P/L" },
  ];
  current = computed(() =>
    this.s.portfolios().find((p) => p.id === this.s.selected()),
  );
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    return [...(this.s.valuation()?.holdings || [])]
      .filter(
        (h) =>
          (h.asset.name + h.asset.symbol).toLowerCase().includes(q) &&
          (!this.assetClass() || h.asset.class === this.assetClass()) &&
          (!this.gainFilter() ||
            (h.gain !== null &&
              (this.gainFilter() === "gain" ? +h.gain >= 0 : +h.gain < 0))),
      )
      .sort((a, b) => {
        const key = this.sort();
        const val = (h: any) =>
          Number(key === "price" ? h.asset.price : h[key]);
        return (
          (val(a) - val(b)) * (this.ascending() ? 1 : -1) ||
          a.asset.symbol.localeCompare(b.asset.symbol)
        );
      });
  });
  constructor() {
    this.route.paramMap.subscribe((p) => {
      if (p.get("id")) this.s.select(p.get("id")!);
    });
    this.creating.set(this.router.url.split("?")[0].endsWith("/new"));
    this.tab.set(
      this.router.url.includes("/transactions") ? "transactions" : "holdings",
    );
    const p = this.route.snapshot.queryParamMap;
    this.query.set(p.get("q") || "");
    this.assetClass.set(p.get("class") || "");
    this.gainFilter.set(p.get("result") || "");
    this.sort.set(p.get("sort") || "value");
    this.ascending.set(p.get("asc") === "true");
  }
  async create() {
    const p = await this.s.mutate(
      "/portfolios",
      "POST",
      { name: this.newName, currency: this.newCurrency },
      "Portfolio created",
    );
    if (p) {
      this.creating.set(false);
      this.newName = "";
      this.select(p.id);
    }
  }
  select(id: string) {
    this.s.select(id);
    this.router.navigate(["/portfolios", id], {
      queryParamsHandling: "preserve",
    });
  }
  setTab(tab: string) {
    this.tab.set(tab);
  }
  portfolioValue(id: string) {
    return this.s.state()?.valuations[id]?.value ?? null;
  }
  filter(q: string) {
    this.query.set(q);
    this.page.set(0);
    this.saveFilters();
  }
  sortBy(key: string) {
    this.ascending.set(this.sort() === key ? !this.ascending() : false);
    this.sort.set(key);
    this.saveFilters();
  }
  saveFilters() {
    this.router.navigate([], {
      queryParams: {
        q: this.query() || null,
        class: this.assetClass() || null,
        result: this.gainFilter() || null,
        sort: this.sort(),
        asc: this.ascending(),
      },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
  cashEntries() {
    return Object.entries(this.s.valuation()?.cash || {});
  }
  transactionRows() {
    return [...this.s.transactions()]
      .filter((t) => !this.transactionType || t.type === this.transactionType)
      .reverse();
  }
  auditRows() {
    const ids = new Set(this.s.transactions().map((t) => t.id));
    return [...(this.s.workspace()?.audit || [])]
      .filter(
        (a) =>
          this.s.selected() === "all" ||
          ids.has(a.entityId) ||
          a.entityId === this.s.selected(),
      )
      .reverse();
  }
  json(a: unknown) {
    return JSON.stringify(a, null, 2);
  }
  async rename() {
    const p = this.current();
    if (!p) return;
    const n = prompt("New portfolio name", p.name);
    if (n !== null)
      await this.s.mutate(
        "/portfolios/" + p.id,
        "PATCH",
        { name: n, revision: p.revision },
        "Portfolio renamed",
      );
  }
  async archive() {
    const p = this.current();
    if (
      p &&
      confirm(
        "Archive this empty portfolio? Its recorded history will be preserved.",
      )
    ) {
      if (
        await this.s.mutate(
          "/portfolios/" + p.id,
          "PATCH",
          { archived: true, revision: p.revision },
          "Portfolio archived",
        )
      )
        this.s.select("all");
    }
  }
  async voidTransaction(id: string, portfolioId: string) {
    const p = this.s.portfolios().find((p) => p.id === portfolioId)!;
    if (
      confirm(
        "Void this transaction? The entire subsequent ledger will be revalidated and the original record preserved in audit history.",
      )
    )
      await this.s.mutate(
        "/transactions/" + id + "/void",
        "POST",
        { revision: p.revision },
        "Transaction voided",
      );
  }
}
