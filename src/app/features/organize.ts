import { Component, inject, signal } from "@angular/core";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from "@angular/forms";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { Store } from "../core/store";
import { Icon, Empty, Source } from "../shared/ui";
import { Watchlist } from "../domain/models";
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, Empty, Source],
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">KEEP YOUR CURIOSITY CLOSE</span>
        <h1>On your radar<span class="accent">.</span></h1>
        <p>A thoughtful place for the investments you want to follow.</p>
      </div>
      <button class="button primary" (click)="creating = !creating">
        <av-icon name="plus" />New watchlist
      </button>
    </div>
    @if (creating) {
      <section class="panel form-panel">
        <form class="inline-form" (ngSubmit)="create()">
          <label
            >Watchlist name<input
              name="name"
              [(ngModel)]="newName"
              required
              maxlength="60"
              placeholder="e.g. Ideas for the future" /></label
          ><button class="button primary" [disabled]="s.busy()">
            Create watchlist
          </button>
        </form>
      </section>
    }
    @for (w of s.workspace()?.watchlists; track w.id) {
      <section class="panel section-gap">
        <div class="panel-heading">
          <div>
            <h2>{{ w.name }}</h2>
            <p>
              {{ w.items.length }} assets and themes · independent of your
              holdings
            </p>
          </div>
          <div class="inline-controls">
            <button class="button text" (click)="rename(w)">Rename</button
            ><button class="button text danger" (click)="remove(w)">
              Delete
            </button>
          </div>
        </div>
        <div class="watchlist-add">
          <select [attr.aria-label]="'Asset to add to ' + w.name" #assetSelect>
            <option value="">Choose an asset or theme to add</option>
            @for (a of s.assets(); track a.id) {
              <option [value]="a.id">{{ a.symbol }} · {{ a.name }}</option>
            }
            @for (t of s.state()?.themes; track t.id) {
              <option [value]="t.id">Theme · {{ t.name }}</option>
            }</select
          ><button class="button secondary" (click)="add(w, assetSelect.value)">
            <av-icon name="plus" />Add
          </button>
        </div>
        @for (id of w.items; track id; let i = $index) {
          <div class="asset-list-row">
            @if (s.asset(id); as a) {
              <span class="asset-symbol" [style.--asset-color]="a.color">{{
                a.symbol.slice(0, 1)
              }}</span
              ><a [routerLink]="['/assets', id]"
                ><strong>{{ a.name }}</strong
                ><small>{{ a.symbol }} · {{ a.exchange }}</small></a
              ><strong>{{ s.money(a.price, a.currency) }}</strong>
            } @else {
              <span class="asset-symbol"><av-icon name="compass" /></span
              ><a [routerLink]="['/themes', id]"
                ><strong>{{ themeName(id) }}</strong
                ><small>Followed theme</small></a
              >
            }
            <div class="inline-controls">
              <button
                class="icon-button"
                [attr.aria-label]="'Move ' + id + ' up'"
                [disabled]="i === 0"
                (click)="move(w, i, -1)"
              >
                ↑</button
              ><button
                class="icon-button"
                [attr.aria-label]="'Move ' + id + ' down'"
                [disabled]="i === w.items.length - 1"
                (click)="move(w, i, 1)"
              >
                ↓</button
              ><button
                class="icon-button"
                [attr.aria-label]="'Remove ' + id"
                (click)="removeItem(w, id)"
              >
                <av-icon name="close" />
              </button>
            </div>
          </div>
        } @empty {
          <av-empty
            icon="star"
            title="A little room for curiosity"
            description="Add an asset above, or explore a theme that interests you."
            ><a routerLink="/discover" class="button secondary"
              >Explore themes</a
            ></av-empty
          >
        }
        <av-source />
      </section>
    } @empty {
      <section class="panel">
        <av-empty
          icon="star"
          title="Keep an eye on what matters"
          description="Create a watchlist to organize your research without changing your holdings."
        />
      </section>
    } `,
})
export class WatchlistsPage {
  s = inject(Store);
  creating = false;
  newName = "";
  async create() {
    if (
      await this.s.mutate(
        "/watchlists",
        "POST",
        { name: this.newName },
        "Watchlist created",
      )
    ) {
      this.creating = false;
      this.newName = "";
    }
  }
  async rename(w: Watchlist) {
    const n = prompt("Watchlist name", w.name);
    if (n !== null)
      await this.s.mutate(
        "/watchlists/" + w.id,
        "PATCH",
        { name: n },
        "Watchlist renamed",
      );
  }
  async remove(w: Watchlist) {
    if (confirm(`Delete “${w.name}”? Independent alerts will remain active.`))
      await this.s.mutate(
        "/watchlists/" + w.id,
        "DELETE",
        {},
        "Watchlist deleted; alerts preserved",
      );
  }
  async add(w: Watchlist, id: string) {
    if (!id) return;
    await this.s.mutate(
      "/watchlists/" + w.id,
      "PATCH",
      { items: [...w.items, id] },
      "Added to watchlist",
    );
  }
  async removeItem(w: Watchlist, id: string) {
    await this.s.mutate(
      "/watchlists/" + w.id,
      "PATCH",
      { items: w.items.filter((x) => x !== id) },
      "Removed from watchlist",
    );
  }
  async move(w: Watchlist, index: number, delta: number) {
    const items = [...w.items];
    [items[index], items[index + delta]] = [items[index + delta], items[index]];
    await this.s.mutate(
      "/watchlists/" + w.id,
      "PATCH",
      { items },
      "Watchlist order updated",
    );
  }
  themeName(id: string) {
    return this.s.state()?.themes.find((t) => t.id === id)?.name || id;
  }
}
@Component({
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, Icon, Empty],
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">LESS CHECKING. MORE PERSPECTIVE.</span>
        <h1>Know when it matters<span class="accent">.</span></h1>
        <p>Set a threshold, then give yourself a little space.</p>
      </div>
      <button class="button primary" (click)="creating.set(!creating())">
        <av-icon name="plus" />Create alert
      </button>
    </div>
    <div class="callout section-gap">
      <av-icon name="info" />
      <p>
        Sample feed: rules are evaluated on the server when a new sample
        observation is submitted below. Continuous market monitoring needs a
        licensed provider and scheduled ingestion. Delivery is in-app only.
      </p>
    </div>
    @if (creating()) {
      <section class="panel form-panel">
        <h2>{{ editId ? "Edit threshold" : "Create a price alert" }}</h2>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <label
              >Asset<select formControlName="assetId">
                @for (a of s.assets(); track a.id) {
                  <option [value]="a.id">{{ a.symbol }} · {{ a.name }}</option>
                }
              </select></label
            ><label
              >Condition<select formControlName="direction">
                <option value="above">Rises above</option>
                <option value="below">Falls below</option>
              </select></label
            ><label
              >Threshold (USD)<input
                formControlName="threshold"
                inputmode="decimal"
                placeholder="e.g. 450.00"
                required /></label
            ><label
              >Cadence<select formControlName="cadence">
                <option value="once">Once</option>
                <option value="recurring">Recurring · 24-hour cooldown</option>
              </select></label
            >
          </div>
          <p class="muted">
            The rule waits for a fresh crossing from the other side. An
            already-satisfied condition does not trigger immediately. Missing or
            stale quotes cannot trigger alerts.
          </p>
          <div class="form-actions">
            <button
              type="button"
              class="button secondary"
              (click)="creating.set(false)"
            >
              Cancel</button
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
            <h3>
              {{ s.asset(a.assetId)?.symbol }}
              {{ a.direction === "above" ? "rises above" : "falls below" }}
              {{ s.money(a.threshold, "USD") }}
            </h3>
            <p>{{ a.paused ? "Paused" : a.state }} · {{ a.cadence }}</p>
          </div>
          <div class="inline-controls">
            <button class="button secondary" (click)="pause(a.id, !a.paused)">
              {{ a.paused ? "Resume" : "Pause" }}</button
            ><a class="button text" [routerLink]="['/alerts', a.id, 'edit']"
              >Edit</a
            ><button class="button text danger" (click)="remove(a.id)">
              Delete
            </button>
          </div>
        </div>
      } @empty {
        <av-empty
          icon="bell"
          title="Quiet, by design"
          description="Your alerts will appear here. Start with a price level you want to keep an eye on."
        />
      }
    </section>
    @if (s.user()?.demo && s.workspace()?.alerts?.length) {
      <details class="panel padded section-gap">
        <summary>Try a sample observation</summary>
        <p>
          Test your alert’s crossing behavior. This does not change holdings or
          displayed prices.
        </p>
        <div class="inline-form">
          <label
            >Asset<select [(ngModel)]="sampleAsset">
              @for (a of s.assets(); track a.id) {
                <option [value]="a.id">{{ a.symbol }}</option>
              }
            </select></label
          ><label
            >Sample price (USD)<input
              [(ngModel)]="samplePrice"
              inputmode="decimal" /></label
          ><button class="button secondary" (click)="observe()">
            Evaluate observation
          </button>
        </div>
      </details>
    } `,
})
export class AlertsPage {
  s = inject(Store);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  creating = signal(false);
  editId = "";
  sampleAsset = "msft-xnas";
  samplePrice = "450";
  form = this.fb.nonNullable.group({
    assetId: ["msft-xnas"],
    direction: ["above"],
    threshold: ["", Validators.required],
    cadence: ["once"],
  });
  constructor() {
    this.creating.set(
      this.router.url.includes("/new") || this.router.url.includes("/edit"),
    );
    this.form.controls.assetId.setValue(
      this.route.snapshot.queryParamMap.get("assetId") || "msft-xnas",
    );
    this.route.paramMap.subscribe((p) => {
      this.editId = p.get("id") || "";
      if (this.editId) {
        const a = this.s.workspace()?.alerts.find((a) => a.id === this.editId);
        if (a) {
          this.form.patchValue(a);
          this.form.controls.assetId.disable();
          this.form.controls.direction.disable();
          this.form.controls.cadence.disable();
        }
      }
    });
  }
  async save() {
    const ok = await this.s.mutate(
      this.editId ? "/alerts/" + this.editId : "/alerts",
      this.editId ? "PATCH" : "POST",
      this.editId
        ? { threshold: this.form.controls.threshold.value }
        : this.form.getRawValue(),
      this.editId ? "Alert updated" : "Alert created",
    );
    if (ok) {
      this.creating.set(false);
      await this.router.navigateByUrl("/alerts");
    }
  }
  async pause(id: string, paused: boolean) {
    await this.s.mutate(
      "/alerts/" + id,
      "PATCH",
      { paused },
      paused ? "Alert paused" : "Alert resumed",
    );
  }
  async remove(id: string) {
    if (confirm("Delete this alert? Existing notifications will be preserved."))
      await this.s.mutate("/alerts/" + id, "DELETE", {}, "Alert deleted");
  }
  async observe() {
    await this.s.mutate(
      "/demo/observations",
      "POST",
      { assetId: this.sampleAsset, value: this.samplePrice },
      "Sample observation evaluated. Check Notifications for any crossing.",
    );
  }
}
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, Icon, Empty],
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">THE UPDATES THAT MATTER</span>
        <h1>Your notification center<span class="accent">.</span></h1>
        <p>Timely context, all in one place.</p>
      </div>
      <button class="button secondary" [disabled]="s.busy()" (click)="read()">
        <av-icon name="check" />Mark all as read
      </button>
    </div>
    <div class="tabs">
      <button [class.active]="!unreadOnly" (click)="unreadOnly = false">
        All notifications</button
      ><button [class.active]="unreadOnly" (click)="unreadOnly = true">
        Unread
      </button>
    </div>
    <section class="panel">
      @for (n of rows(); track n.id) {
        <article class="notification-row" [class.unread]="!n.readAt">
          <span class="alert-icon"><av-icon name="bell" /></span>
          <div>
            <h3>{{ n.title }} · {{ s.asset(n.assetId)?.symbol }}</h3>
            <p>{{ n.message }}</p>
            <small>{{ n.createdAt }}</small>
            <div>
              <a
                [routerLink]="['/assets', n.assetId]"
                (click)="read(n.id)"
                class="button text"
                >View asset <av-icon name="arrow"
              /></a>
              @if (!n.readAt) {
                <button class="button text" (click)="read(n.id)">
                  Mark as read
                </button>
              }
            </div>
          </div>
        </article>
      } @empty {
        <av-empty
          icon="check"
          title="You’re all caught up"
          description="When a valid observation crosses one of your alert thresholds, you’ll find it here."
          ><a routerLink="/alerts" class="button secondary"
            >Manage alerts</a
          ></av-empty
        >
      }
    </section>`,
})
export class NotificationsPage {
  s = inject(Store);
  unreadOnly = false;
  rows() {
    return (
      this.s
        .workspace()
        ?.notifications.filter((n) => !this.unreadOnly || !n.readAt) || []
    );
  }
  async read(id?: string) {
    await this.s.mutate(
      "/notifications/mark-read",
      "POST",
      { id },
      id ? "Notification marked as read" : "All notifications marked as read",
    );
  }
}
