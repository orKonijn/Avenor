import { Component, inject } from "@angular/core";
import { ReactiveFormsModule, FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Icon, Empty } from "../shared/ui";
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">MAKE YOURSELF AT HOME</span>
        <h1>
          {{
            onboarding
              ? "Start with your perspective"
              : "A workspace that feels like you"
          }}<span class="accent">.</span>
        </h1>
        <p>
          {{
            onboarding
              ? "A few preferences, then your first portfolio."
              : "Set the details that make your investment picture easier to read."
          }}
        </p>
      </div>
    </div>
    @if (!onboarding) {
      <div class="tabs">
        <a
          routerLink="/settings/preferences"
          [class.active]="section === 'preferences'"
          >Preferences</a
        ><a
          routerLink="/settings/account"
          [class.active]="section === 'account'"
          >Account</a
        ><a
          routerLink="/settings/notifications"
          [class.active]="section === 'notifications'"
          >Notifications</a
        >
      </div>
    }
    @if (section === "preferences" || onboarding) {
      <div class="settings-layout">
        <section class="panel form-panel">
          <form [formGroup]="form" (ngSubmit)="save()">
            <h2>Display preferences</h2>
            <p class="muted">
              Display currency changes how values are shown. It never converts
              your actual cash or edits original transactions.
            </p>
            <div class="form-grid">
              <label
                >Display currency<select formControlName="currency">
                  @for (c of s.state()?.currencies; track c) {
                    <option>{{ c }}</option>
                  }
                </select></label
              ><label
                >Number and date locale<select formControlName="locale">
                  <option value="en-US">English (United States)</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="de-DE">German number formatting</option>
                </select></label
              ><label class="span-2"
                >Time zone<input
                  formControlName="timeZone"
                  placeholder="e.g. Europe/London"
              /></label>
            </div>
            <h3>Appearance</h3>
            <div class="appearance-options">
              @for (mode of ["light", "dark", "system"]; track mode) {
                <label
                  [class.selected]="form.controls.appearance.value === mode"
                  ><input
                    type="radio"
                    formControlName="appearance"
                    [value]="mode"
                  />
                  <div
                    class="theme-swatch"
                    [class.dark-swatch]="mode === 'dark'"
                    [class.system-swatch]="mode === 'system'"
                  >
                    <i></i><i></i><i></i>
                  </div>
                  <span>{{
                    mode.charAt(0).toUpperCase() + mode.slice(1)
                  }}</span></label
                >
              }
            </div>
            <div class="form-actions">
              <button class="button primary" [disabled]="s.busy()">
                {{
                  onboarding
                    ? "Save & create your portfolio"
                    : "Save preferences"
                }}<av-icon name="arrow" />
              </button>
            </div>
          </form>
        </section>
        <aside class="panel padded">
          <av-icon name="info" />
          <h2>Clarity includes the gaps.</h2>
          <p>
            Only USD sample quotes are available. If you choose EUR or GBP,
            valuations requiring an unavailable FX rate are marked incomplete.
            We never substitute an assumed exchange rate.
          </p>
          <p>
            System appearance follows your device. Explicit Light or Dark stays
            selected across sessions.
          </p>
        </aside>
      </div>
    }
    @if (section === "account" && !onboarding) {
      <section class="panel padded narrow">
        <h2>Your account</h2>
        <dl>
          <dt>Name</dt>
          <dd>{{ s.user()?.name }}</dd>
          <dt>Email</dt>
          <dd>
            {{ s.user()?.demo ? "Isolated sample identity" : s.user()?.email }}
          </dd>
          <dt>Workspace</dt>
          <dd>
            {{
              s.user()?.demo ? "Demo · separate from real accounts" : "Personal"
            }}
          </dd>
          <dt>Email verification</dt>
          <dd>{{ s.user()?.verified ? "Verified" : "Pending" }}</dd>
        </dl>
        <div class="callout">
          <av-icon name="shield" />
          <p>
            Sample workspaces are isolated per session. Production account
            management, deletion retention, and external identity-provider
            configuration must be completed before launch.
          </p>
        </div>
        <a routerLink="/auth/recover" class="button secondary"
          >Request password reset</a
        >
      </section>
    }
    @if (section === "notifications" && !onboarding) {
      <section class="panel padded narrow">
        <h2>Your delivery channels</h2>
        <div class="setting-row">
          <div>
            <strong>In-app notifications</strong>
            <p>Crossing alerts, kept in your notification center.</p>
          </div>
          <span class="badge positive">Enabled</span>
        </div>
        <div class="setting-row">
          <div>
            <strong>Email alerts</strong>
            <p>Not available in this release.</p>
          </div>
          <span class="badge">Unavailable</span>
        </div>
        <div class="setting-row">
          <div>
            <strong>Push notifications</strong>
            <p>Not available in this release.</p>
          </div>
          <span class="badge">Unavailable</span>
        </div>
        <a routerLink="/alerts" class="button secondary">Manage alert rules</a>
      </section>
    } `,
})
export class SettingsPage {
  s = inject(Store);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  onboarding = this.router.url.includes("/onboarding");
  section = "preferences";
  form = this.fb.nonNullable.group({
    currency: ["USD"],
    locale: ["en-US"],
    timeZone: ["UTC"],
    appearance: ["system"],
  });
  constructor() {
    this.route.paramMap.subscribe(
      (p) => (this.section = p.get("section") || "preferences"),
    );
    this.form.patchValue(this.s.workspace()!.preferences);
  }
  async save() {
    const data = {
      ...this.s.workspace()!.preferences,
      ...this.form.getRawValue(),
      onboarding: this.onboarding
        ? 3
        : this.s.workspace()!.preferences.onboarding,
    };
    if (
      await this.s.mutate("/me/preferences", "PATCH", data, "Preferences saved")
    ) {
      this.s.applyTheme(data.appearance);
      if (this.onboarding) await this.router.navigateByUrl("/portfolios/new");
    }
  }
}
@Component({
  standalone: true,
  imports: [RouterLink, Empty],
  template: `<section class="panel">
    <av-empty
      title="This page is off the map"
      description="The page may have moved, or this link may be incomplete."
      ><a routerLink="/overview" class="button primary"
        >Back to your overview</a
      ></av-empty
    >
  </section>`,
})
export class NotFoundPage {}
