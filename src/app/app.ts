import { Component, inject, signal } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  NavigationEnd,
} from "@angular/router";
import { FormsModule } from "@angular/forms";
import { Store } from "./core/store";
import { Icon, Logo } from "./shared/ui";
@Component({
  selector: "av-root",
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    Icon,
    Logo,
  ],
  template: `
    <a class="skip" href="#main">Skip to content</a>
    @if (!s.ready()) {
      <div class="boot" role="status">
        <av-logo />
        <p>Preparing your workspace…</p>
      </div>
    } @else if (!s.user()) {
      <router-outlet />
    } @else {
      <aside class="sidebar">
        <a routerLink="/overview" class="brand-link" aria-label="Avenor home"
          ><av-logo
        /></a>
        <div class="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          @for (item of navigation; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [attr.title]="item.label"
              ><av-icon [name]="item.icon" /><span>{{ item.label }}</span>
              @if (item.label === "Notifications" && unread()) {
                <b class="nav-count">{{ unread() }}</b>
              }
            </a>
          }
        </nav>
        <div class="sidebar-bottom">
          <div class="sample-note">
            <span class="mini-orbit">✧</span
            ><strong>Space for the bigger picture.</strong>
            <p>A little perspective goes a long way.</p>
            <a routerLink="/discover"
              >Explore themes <av-icon name="arrow"
            /></a>
          </div>
          <a
            routerLink="/settings/preferences"
            routerLinkActive="active"
            class="settings-link"
            ><av-icon name="settings" /><span>Settings</span></a
          ><button class="profile" (click)="logout()">
            <span class="avatar">{{ s.user()?.name?.slice(0, 1) }}</span
            ><span
              ><strong>{{ s.user()?.name }}</strong
              ><small>{{
                s.user()?.demo ? "Sample workspace" : "Personal account"
              }}</small></span
            ><av-icon name="logout" />
          </button>
        </div>
      </aside>
      <div class="app-main">
        <header class="topbar">
          <span class="breadcrumb"
            >Workspace <span>/</span> {{ pageTitle() }}</span
          >
          <div class="global-search">
            <av-icon name="search" /><input
              aria-label="Search assets"
              placeholder="Search assets, symbols…"
              [(ngModel)]="search"
              (focus)="searchOpen = true"
              (keydown.escape)="searchOpen = false"
            />
            @if (searchOpen && search) {
              <div class="search-results">
                @for (a of searchAssets(); track a.id) {
                  <a
                    [routerLink]="['/assets', a.id]"
                    (click)="searchOpen = false; search = ''"
                    class="search-result"
                    ><span class="asset-symbol" [style.color]="a.color">{{
                      a.symbol.slice(0, 1)
                    }}</span
                    ><span
                      ><strong>{{ a.symbol }}</strong
                      ><small>{{ a.name }} · {{ a.exchange }}</small></span
                    ><span>{{ s.money(a.price, a.currency) }}</span></a
                  >
                } @empty {
                  <p>No matching assets.</p>
                }
              </div>
            }
          </div>
          <div class="header-actions">
            <span class="sample-badge">{{
              s.user()?.demo ? "Sample workspace" : "Personal workspace"
            }}</span
            ><button
              class="icon-button"
              aria-label="Toggle light and dark appearance"
              (click)="toggleTheme()"
            >
              <av-icon name="moon" /></button
            ><a
              routerLink="/notifications"
              class="icon-button"
              aria-label="Notifications"
              ><av-icon name="bell" /></a
            ><span class="avatar small">{{ s.user()?.name?.slice(0, 1) }}</span>
          </div>
        </header>
        <main id="main" tabindex="-1">
          @if (s.error()) {
            <div class="banner error" role="alert">
              <av-icon name="info" /><span>{{ s.error() }}</span
              ><button (click)="s.refresh()">Reload data</button
              ><button
                class="icon-button"
                aria-label="Dismiss error"
                (click)="s.error.set('')"
              >
                <av-icon name="close" />
              </button>
            </div>
          }
          @if (s.notice()) {
            <div class="banner success" role="status">
              <av-icon name="check" /><span>{{ s.notice() }}</span
              ><button
                class="icon-button"
                aria-label="Dismiss message"
                (click)="s.notice.set('')"
              >
                <av-icon name="close" />
              </button>
            </div>
          }
          <router-outlet />
        </main>
        <footer class="app-footer">
          <span>A little clarity. A better perspective.</span
          ><span
            >{{
              s.user()?.demo
                ? "Sample market data"
                : "Provider quotes when available"
            }}
            · Tracking, not trading.</span
          >
        </footer>
      </div>
      <nav class="mobile-nav" aria-label="Mobile navigation">
        <a routerLink="/overview" routerLinkActive="active"
          ><av-icon name="grid" />Home</a
        ><a routerLink="/portfolios" routerLinkActive="active"
          ><av-icon name="portfolio" />Portfolio</a
        ><a routerLink="/discover" routerLinkActive="active"
          ><av-icon name="compass" />Explore</a
        ><button (click)="more.set(!more())" [attr.aria-expanded]="more()">
          <av-icon name="more" />More
        </button>
      </nav>
      @if (more()) {
        <div class="mobile-more">
          <button
            class="icon-button"
            aria-label="Close navigation"
            (click)="more.set(false)"
          >
            <av-icon name="close" />
          </button>
          @for (item of navigation.slice(2); track item.path) {
            <a [routerLink]="item.path" (click)="more.set(false)"
              ><av-icon [name]="item.icon" />{{ item.label }}</a
            >
          }
          <a routerLink="/settings/preferences" (click)="more.set(false)"
            ><av-icon name="settings" />Settings</a
          ><button (click)="logout()">Sign out</button>
        </div>
      }
    }
  `,
})
export class App {
  s = inject(Store);
  router = inject(Router);
  search = "";
  searchOpen = false;
  more = signal(false);
  pageTitle = signal("Overview");
  navigation = [
    { path: "/overview", label: "Overview", icon: "grid" },
    { path: "/portfolios", label: "Portfolios", icon: "portfolio" },
    { path: "/analysis", label: "Analysis", icon: "chart" },
    { path: "/discover", label: "Discover", icon: "compass" },
    { path: "/watchlists", label: "Watchlists", icon: "star" },
    { path: "/alerts", label: "Alerts", icon: "bell" },
    { path: "/notifications", label: "Notifications", icon: "clock" },
    { path: "/changelog", label: "Changelog", icon: "info" },
  ];
  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        const segment =
          e.urlAfterRedirects.split("/")[1]?.split("?")[0] || "overview";
        this.pageTitle.set(
          segment === "assets"
            ? "Asset detail"
            : segment.charAt(0).toUpperCase() + segment.slice(1),
        );
        this.more.set(false);
      }
    });
  }
  searchAssets() {
    const q = this.search.toLowerCase();
    return this.s
      .assets()
      .filter((a) =>
        (a.name + a.symbol + a.exchange).toLowerCase().includes(q),
      );
  }
  unread() {
    return (
      this.s.workspace()?.notifications.filter((n) => !n.readAt).length || 0
    );
  }
  async toggleTheme() {
    const mode =
      document.documentElement.dataset["theme"] === "dark" ? "light" : "dark";
    this.s.applyTheme(mode);
    await this.s.mutate(
      "/me/preferences",
      "PATCH",
      { ...this.s.workspace()!.preferences, appearance: mode },
      "Appearance updated",
    );
  }
  async logout() {
    if (
      confirm("Sign out of this workspace? Unsaved changes will be discarded.")
    ) {
      if (await this.s.logout()) await this.router.navigateByUrl("/auth/login");
    }
  }
}
