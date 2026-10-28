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
            <h3>
              {{ n.title }} ·
              {{
                n.portfolioId
                  ? portfolioName(n.portfolioId)
                  : s.asset(n.assetId)?.symbol
              }}
            </h3>
            <p>{{ n.message }}</p>
            <small>{{ n.createdAt }}</small>
            <div>
              <a
                [routerLink]="
                  n.portfolioId
                    ? ['/portfolios', n.portfolioId]
                    : ['/assets', n.assetId]
                "
                (click)="read(n.id)"
                class="button text"
                >View context <av-icon name="arrow"
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
  portfolioName(id: string) {
    return (
      this.s.workspace()?.portfolios.find((p) => p.id === id)?.name ||
      "Portfolio"
    );
  }
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
