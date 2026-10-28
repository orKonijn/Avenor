import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Icon, Empty, Source } from "../shared/ui";
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, Empty, Source],
  template: `
    @if (detail(); as t) {
      <a routerLink="/discover" class="back-link">← All themes</a>
      <div class="theme-detail-hero" [style.--theme-color]="t.color">
        <div>
          <span class="eyebrow">{{ t.sector }} · CURATED THEME</span>
          <h1>{{ t.name }}</h1>
          <p>{{ t.description }}</p>
          <button
            class="button primary"
            [disabled]="s.busy()"
            (click)="follow(t.id)"
          >
            <av-icon name="star" />{{
              isFollowed(t.id) ? "Following theme" : "Follow theme"
            }}
          </button>
        </div>
        <div class="theme-geometry"><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="two-columns">
        <section class="panel padded">
          <span class="eyebrow">THE THESIS</span>
          <h2>Why it matters</h2>
          <p>{{ t.thesis }}</p>
          <h3>The other side of the story</h3>
          <p>{{ t.counterpoint }}</p>
        </section>
        <section class="panel padded">
          <span class="eyebrow">EVIDENCE, NOT PREDICTIONS</span>
          <h2>Unrated</h2>
          <p>
            This sample theme has {{ t.assets.length }} members and no licensed
            evidence feed. Ratings require five liquid assets, 80% usable
            history, and three distinct sourced developments.
          </p>
          <details>
            <summary>Read the scoring methodology</summary>
            <p>
              40% momentum percentile + 30% breadth percentile + 30%
              development-activity percentile. Activity is not positive
              sentiment. Stable ties sort alphabetically. Formula v1; score
              unavailable until coverage and eligibility are satisfied.
            </p>
          </details>
        </section>
      </div>
      <section class="panel section-gap">
        <div class="panel-heading">
          <h2>Explore the theme’s assets</h2>
          <span class="badge">Illustrative membership · 28 Oct 2026</span>
        </div>
        @for (id of t.assets; track id) {
          @if (s.asset(id); as a) {
            <a [routerLink]="['/assets', a.id]" class="asset-list-row"
              ><span class="asset-symbol" [style.--asset-color]="a.color">{{
                a.symbol.slice(0, 1)
              }}</span
              ><span
                ><strong>{{ a.name }}</strong
                ><small>{{ a.symbol }} · {{ a.exchange }}</small></span
              ><strong>{{ s.money(a.price, a.currency) }}</strong
              ><av-icon name="arrow"
            /></a>
          }
        }
        <av-source />
      </section>
      <section class="panel section-gap">
        <av-empty
          icon="book"
          title="Evidence feed not connected"
          description="Dated supporting and countervailing sources will appear here when a licensed news provider is configured. No sample headlines are presented as real news."
        />
      </section>
    } @else {
      <div class="page-heading">
        <div>
          <span class="eyebrow">CURIOSITY, WITH CONTEXT</span>
          <h1>Discover a wider perspective<span class="accent">.</span></h1>
          <p>
            Big ideas, grounded in evidence. Explore what’s shaping the world
            around your investments.
          </p>
        </div>
      </div>
      <div class="discovery-hero">
        <div>
          <span class="eyebrow">THE BIGGER PICTURE</span>
          <h2>See the idea.<br />Understand the context.</h2>
          <p>
            A theme is a starting point for research.<br />Explore the
            opportunity and the counterpoint, together.
          </p>
          <a
            routerLink="/themes/intelligent-infrastructure"
            class="button primary"
            >Explore intelligent infrastructure <av-icon name="arrow"
          /></a>
        </div>
        <div class="discovery-art">
          <div class="art-grid"></div>
          <div class="art-cube cube-one"></div>
          <div class="art-cube cube-two"></div>
          <div class="art-cube cube-three"></div>
          <span>CONNECT THE DOTS.</span>
        </div>
      </div>
      <div class="filter-toolbar">
        <div class="inline-controls">
          <label class="search-field"
            ><av-icon name="search" /><input
              [(ngModel)]="query"
              aria-label="Search themes"
              placeholder="Find a theme…" /></label
          ><select [(ngModel)]="sector" aria-label="Theme sector">
            <option value="">All sectors</option>
            <option>Technology</option>
            <option>Diversification</option>
            <option>Fixed income</option></select
          ><button class="button text" (click)="query = ''; sector = ''">
            Reset filters
          </button>
        </div>
        <span class="muted"
          >{{ filtered().length }} curated themes · Alphabetical</span
        >
      </div>
      <div class="discovery-grid">
        @for (t of filtered(); track t.id) {
          <article class="theme-card">
            <a
              [routerLink]="['/themes', t.id]"
              class="theme-art"
              [style.--theme-color]="t.color"
              ><span class="badge">{{ t.sector }}</span>
              <div class="theme-geometry"><i></i><i></i><i></i><i></i></div>
              <span class="theme-art-label"
                >AVENOR PERSPECTIVES / 0{{ $index + 1 }}</span
              ></a
            >
            <div class="theme-card-body">
              <div class="inline-between">
                <span class="eyebrow"
                  >{{ t.assets.length }} ILLUSTRATIVE ASSETS</span
                ><button
                  class="icon-button"
                  [attr.aria-label]="
                    isFollowed(t.id) ? 'Unfollow ' + t.name : 'Follow ' + t.name
                  "
                  [attr.aria-pressed]="isFollowed(t.id)"
                  (click)="follow(t.id)"
                >
                  <av-icon [name]="isFollowed(t.id) ? 'check' : 'plus'" />
                </button>
              </div>
              <a [routerLink]="['/themes', t.id]"
                ><h2>{{ t.name }}</h2></a
              >
              <p>{{ t.description }}</p>
              <div class="theme-card-footer">
                <span class="badge">Unrated · insufficient evidence</span
                ><a [routerLink]="['/themes', t.id]" aria-label="Explore theme"
                  ><av-icon name="arrow"
                /></a>
              </div>
            </div>
          </article>
        } @empty {
          <av-empty
            title="No themes match"
            description="Try a different search or reset your filters."
          />
        }
      </div>
      <div class="methodology-strip">
        <av-icon name="info" />
        <p>
          No hidden personalized ranking. Sample themes are sorted
          alphabetically. Evidence scores stay unavailable until the required
          data exists.
        </p>
      </div>
    }
  `,
})
export class DiscoverPage {
  s = inject(Store);
  route = inject(ActivatedRoute);
  id = signal("");
  query = "";
  sector = "";
  constructor() {
    this.route.paramMap.subscribe((p) => this.id.set(p.get("id") || ""));
  }
  detail() {
    return this.s.state()?.themes.find((t) => t.id === this.id());
  }
  filtered() {
    return [...(this.s.state()?.themes || [])]
      .filter(
        (t) =>
          (!this.sector || t.sector === this.sector) &&
          (t.name + t.description)
            .toLowerCase()
            .includes(this.query.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  isFollowed(id: string) {
    return this.s.workspace()?.followedThemes.includes(id);
  }
  async follow(id: string) {
    await this.s.mutate(
      "/themes/" + id + "/follow",
      "POST",
      {},
      this.isFollowed(id) ? "Theme unfollowed" : "Theme followed",
    );
  }
}
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, Empty, Source],
  template: `
    @if (asset(); as a) {
      <a routerLink="/portfolios" class="back-link"
        >← Back to your investments</a
      >
      <div class="page-heading asset-heading">
        <div class="asset-title">
          <span class="asset-symbol large" [style.--asset-color]="a.color">{{
            a.symbol.slice(0, 1)
          }}</span>
          <div>
            <span class="eyebrow"
              >{{ a.symbol }} · {{ a.exchange }} · {{ a.currency }}</span
            >
            <h1>{{ a.name }}</h1>
            <p>{{ a.class }} · {{ a.sector }}</p>
          </div>
        </div>
        <div class="inline-controls">
          <button class="button secondary" (click)="watchOpen = !watchOpen">
            <av-icon name="star" />Add to watchlist</button
          ><a
            routerLink="/alerts/new"
            [queryParams]="{ assetId: a.id }"
            class="button primary"
            ><av-icon name="bell" />Create alert</a
          >
        </div>
      </div>
      @if (watchOpen) {
        <section class="panel form-panel">
          <h2>Add {{ a.symbol }} to a watchlist</h2>
          <div class="inline-form">
            <label
              >Watchlist<select [(ngModel)]="watchlist">
                <option value="">Choose a watchlist</option>
                @for (w of s.workspace()?.watchlists; track w.id) {
                  <option [value]="w.id">{{ w.name }}</option>
                }
              </select></label
            ><button class="button primary" (click)="addToWatchlist()">
              Add asset</button
            ><a routerLink="/watchlists" class="button secondary"
              >Manage watchlists</a
            >
          </div>
        </section>
      }
      <div class="asset-detail-grid">
        <section class="panel padded">
          <span class="eyebrow">SAMPLE QUOTE</span>
          <div class="asset-price">
            {{ s.money(a.price, a.currency)
            }}<span class="positive">{{
              a.price && a.previousPrice
                ? s.percent((+a.price / +a.previousPrice - 1) * 100)
                : "—"
            }}</span>
          </div>
          <av-source />
          <div class="quote-visual">
            <span class="quote-line"></span>
            <div>
              <av-icon name="chart" />
              <h3>Historical price feed not connected</h3>
              <p>
                The sample snapshot is available. A line or candlestick chart
                needs actual dated prices and OHLC coverage.
              </p>
            </div>
          </div>
        </section>
        <section class="panel padded">
          <h2>About {{ a.symbol }}</h2>
          <p>{{ a.description }}</p>
          <dl>
            <dt>Exchange</dt>
            <dd>{{ a.exchange }}</dd>
            <dt>Quote currency</dt>
            <dd>{{ a.currency }}</dd>
            <dt>Classification</dt>
            <dd>{{ a.class }}</dd>
            <dt>Geography</dt>
            <dd>{{ a.geography }}</dd>
            <dt>Trailing P/E</dt>
            <dd title="Fundamentals provider not connected">—</dd>
            <dt>Volume</dt>
            <dd title="Volume feed not connected">—</dd>
          </dl>
          <small class="muted"
            >Unavailable metrics require a fundamentals provider. Sample prices
            are not current market quotes.</small
          >
        </section>
      </div>
      @if (holdings().length) {
        <section class="panel section-gap">
          <div class="panel-heading">
            <h2>Your position in {{ a.symbol }}</h2>
            <a
              routerLink="/transactions/new"
              [queryParams]="{ portfolioId: portfolioId }"
              class="text-link"
              >Record a transaction <av-icon name="arrow"
            /></a>
          </div>
          @for (h of holdings(); track $index) {
            <div class="position-metrics">
              <div>
                <span>Quantity</span
                ><strong>{{ s.number(h.quantity, 8) }}</strong>
              </div>
              <div>
                <span>Remaining basis</span
                ><strong>{{ s.money(h.basis, a.currency) }}</strong>
              </div>
              <div>
                <span>Market value</span><strong>{{ s.money(h.value) }}</strong>
              </div>
              <div>
                <span>Unrealized P/L</span
                ><strong [class.positive]="+(h.gain || 0) >= 0">{{
                  s.money(h.gain)
                }}</strong>
              </div>
              <div>
                <span>Realized P/L</span
                ><strong>{{ s.money(h.realized, a.currency) }}</strong>
              </div>
            </div>
            <details class="lots">
              <summary>Remaining FIFO lots ({{ h.lots.length }})</summary>
              @if (h.basis === null) {
                <p class="callout">
                  Cost basis is unknown for one or more lots. Gains remain
                  unavailable until the opening record is corrected.
                </p>
              }
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Opening transaction</th>
                      <th class="numeric">Quantity</th>
                      <th class="numeric">Remaining basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (lot of h.lots; track lot.transactionId) {
                      <tr>
                        <td>
                          <a
                            [routerLink]="[
                              '/transactions',
                              lot.transactionId,
                              'edit',
                            ]"
                            >{{ lot.transactionId }}</a
                          ><small
                            >Acquired:
                            {{
                              lot.acquiredAt?.slice(0, 10) || "Unknown date"
                            }}</small
                          >
                        </td>
                        <td class="numeric">{{ lot.quantity }}</td>
                        <td class="numeric">
                          {{ s.money(lot.basis, a.currency) }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </details>
          }
        </section>
      }
      <div class="two-columns section-gap">
        <section class="panel">
          <div class="panel-heading"><h2>News, in context</h2></div>
          <av-empty
            icon="book"
            title="No connected news feed"
            description="Original publishers, source links, timestamps, and relevance reasons will appear with licensed coverage."
          />
        </section>
        <section class="panel">
          <div class="panel-heading"><h2>On the horizon</h2></div>
          <av-empty
            icon="clock"
            title="No verified events available"
            description="Scheduled and confirmed events require a connected source. Dates are never inferred from sample data."
          />
        </section>
      </div>
    } @else {
      <av-empty
        title="Asset not found"
        description="This listing is not available in the connected asset universe."
        ><a routerLink="/discover" class="button primary"
          >Explore themes</a
        ></av-empty
      >
    }
  `,
})
export class AssetPage {
  s = inject(Store);
  route = inject(ActivatedRoute);
  id = signal("");
  portfolioId = "";
  watchOpen = false;
  watchlist = "";
  constructor() {
    this.route.paramMap.subscribe((p) => {
      this.id.set(p.get("assetId") || p.get("id") || "");
      if (p.get("assetId")) {
        this.portfolioId = p.get("id") || "";
        this.s.select(this.portfolioId);
      }
    });
  }
  asset() {
    return this.s.asset(this.id());
  }
  holdings() {
    return (
      this.s.valuation()?.holdings.filter((h) => h.assetId === this.id()) || []
    );
  }
  async addToWatchlist() {
    const w = this.s
      .workspace()
      ?.watchlists.find((w) => w.id === this.watchlist);
    if (!w) {
      this.s.error.set("Choose a watchlist first.");
      return;
    }
    if (
      await this.s.mutate(
        "/watchlists/" + w.id,
        "PATCH",
        { items: [...w.items, this.id()] },
        "Asset added to watchlist",
      )
    )
      this.watchOpen = false;
  }
}
