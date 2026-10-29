import { Injectable, signal, computed, inject, effect } from "@angular/core";
import { Router } from "@angular/router";
import { Bootstrap, Workspace, Asset, Watchlist } from "../domain/models";
@Injectable({ providedIn: "root" })
export class Store {
  readonly router = inject(Router);
  readonly draft = signal<any>(null);
  lastErrorStatus = 0;
  readonly state = signal<Bootstrap | null>(null);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly notice = signal("");
  readonly selected = signal(
    sessionStorage.getItem("avenor-portfolio") || "all",
  );
  readonly range = signal("YTD");
  readonly workspace = computed(() => this.state()?.workspace);
  readonly user = computed(() => this.state()?.user);
  readonly assets = computed(() => this.state()?.assets || []);
  readonly portfolios = computed(
    () => this.workspace()?.portfolios.filter((p) => !p.archived) || [],
  );
  readonly transactions = computed(
    () =>
      this.workspace()?.transactions.filter(
        (t) => this.selected() === "all" || t.portfolioId === this.selected(),
      ) || [],
  );
  readonly valuation = computed(
    () => this.state()?.valuations[this.selected()] || null,
  );
  private appearance = "system";
  constructor() {
    effect(() => {
      document.documentElement.dataset["density"] =
        this.workspace()?.preferences.density ?? "comfortable";
    });
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      if (this.appearance === "system") this.applyTheme("system");
    });
    window.addEventListener("offline", () =>
      this.error.set(
        "You are offline. Your saved data is available; reconnect before saving changes.",
      ),
    );
    window.addEventListener("online", () => this.error.set(""));
  }
  async request<T = any>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<T> {
    const requestOwnerId = this.user()?.id;
    const response = await fetch("/v1" + path, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(this.state() ? { "X-CSRF-Token": this.state()!.csrf } : {}),
        ...(method !== "GET"
          ? { "Idempotency-Key": key || crypto.randomUUID() }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = await response.json();
    if (!response.ok) {
      this.lastErrorStatus = response.status;
      if (
        response.status === 401 &&
        this.state() &&
        this.user()?.id === requestOwnerId
      ) {
        this.state.set(null);
        this.selected.set("all");
        sessionStorage.removeItem("avenor-portfolio");
        void this.router.navigateByUrl("/auth/login");
      }
      throw new Error(
        json.message || "The service is unavailable. Please try again.",
      );
    }
    return json.data;
  }
  async init() {
    try {
      this.state.set(await this.request<Bootstrap>("/session"));
      this.applyTheme(this.workspace()!.preferences.appearance);
    } catch {
    } finally {
      this.ready.set(true);
    }
  }
  async login(kind: string, body: unknown = {}) {
    this.error.set("");
    this.busy.set(true);
    try {
      const data = await this.request("/auth/" + kind, "POST", body);
      if (data.user) {
        if (this.draft()?.ownerId !== data.user.id) this.draft.set(null);
        this.state.set(data);
        this.selected.set("all");
        this.applyTheme(data.workspace.preferences.appearance);
      } else this.notice.set(data.message);
      return data;
    } catch (e) {
      this.error.set((e as Error).message);
      return null;
    } finally {
      this.busy.set(false);
    }
  }
  async mutate(
    path: string,
    method: string,
    body: unknown = {},
    message = "Changes saved",
    key?: string,
  ) {
    if (this.busy()) return null;
    const ownerId = this.user()?.id;
    this.error.set("");
    this.notice.set("");
    this.lastErrorStatus = 0;
    this.busy.set(true);
    try {
      const data = await this.request<{
        workspace: Workspace;
        valuations: Bootstrap["valuations"];
        assets?: Asset[];
        market?: Bootstrap["market"];
        result: any;
      }>(path, method, body, key);
      if (this.user()?.id !== ownerId) return null;
      this.state.update((s) =>
        s && (data.workspace.revision || 0) >= (s.workspace.revision || 0)
          ? {
              ...s,
              workspace: data.workspace,
              valuations: data.valuations,
              assets: data.assets ?? s.assets,
              market: data.market ?? s.market,
            }
          : s,
      );
      this.notice.set(message);
      return data.result || true;
    } catch (e) {
      if (this.user()?.id === ownerId) this.error.set((e as Error).message);
      return null;
    } finally {
      this.busy.set(false);
    }
  }
  async updateWatchlist(
    w: Watchlist,
    method: "PATCH" | "DELETE",
    changes: object,
    message: string,
  ) {
    if (this.busy()) return null;
    const ownerId = this.user()?.id;
    const result = await this.mutate(
      "/watchlists/" + w.id,
      method,
      { ...changes, revision: w.revision ?? 0 },
      message,
    );
    if (
      !result &&
      this.user()?.id === ownerId &&
      [404, 409].includes(this.lastErrorStatus)
    ) {
      this.busy.set(true);
      try {
        await this.refresh();
        if (!this.error() && this.user()?.id === ownerId)
          this.error.set(
            "This watchlist changed in another tab. The latest lists are now loaded. Your change was not applied. Review the list before trying again.",
          );
      } finally {
        this.busy.set(false);
      }
    }
    return result;
  }
  async refresh() {
    try {
      const fresh = await this.request<Bootstrap>("/session");
      this.state.update((current) =>
        current &&
        fresh.user.id === current.user.id &&
        (fresh.workspace.revision || 0) >= (current.workspace.revision || 0)
          ? fresh
          : current,
      );
      this.error.set("");
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async logout() {
    try {
      await this.request("/logout", "POST", {});
      this.state.set(null);
      this.draft.set(null);
      this.selected.set("all");
      sessionStorage.removeItem("avenor-portfolio");
      this.notice.set("");
      return true;
    } catch (e) {
      this.error.set((e as Error).message);
      return false;
    }
  }
  select(id: string) {
    this.selected.set(id);
    sessionStorage.setItem("avenor-portfolio", id);
  }
  applyTheme(mode: string) {
    this.appearance = mode;
    localStorage.setItem("avenor-theme", mode);
    document.documentElement.dataset["theme"] =
      mode === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : mode;
  }
  money(value: string | number | null | undefined, currency?: string) {
    return value == null
      ? "—"
      : new Intl.NumberFormat(this.workspace()?.preferences.locale || "en-US", {
          style: "currency",
          currency: currency || this.workspace()?.preferences.currency || "USD",
          maximumFractionDigits: 2,
        }).format(Number(value));
  }
  number(value: string | number | null | undefined, digits = 2) {
    return value == null
      ? "—"
      : new Intl.NumberFormat(this.workspace()?.preferences.locale || "en-US", {
          maximumFractionDigits: digits,
        }).format(Number(value));
  }
  percent(value: string | number | null | undefined) {
    return value == null
      ? "—"
      : `${Number(value) > 0 ? "+" : ""}${this.number(value)}%`;
  }
  asset(id: string): Asset | undefined {
    return this.assets().find((a) => a.id === id);
  }
}
