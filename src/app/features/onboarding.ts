import { Component, HostListener, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Icon } from "../shared/ui";
import { INTERESTS } from "../domain/preferences";
import { OpeningDraft } from "../domain/models";

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">YOUR FIRST CLEAR PICTURE</span>
        <h1>A thoughtful place to start<span class="accent">.</span></h1>
        <p>
          Set your preferences, give your portfolio a name, and tell us what you
          already own.
        </p>
      </div>
      <span class="badge">{{
        s.user()?.demo ? "Isolated sample setup" : "Personal workspace"
      }}</span>
    </div>
    <nav class="tabs" aria-label="Setup progress">
      @for (label of labels; track label; let i = $index) {
        <a
          [routerLink]="['/onboarding', steps[i]]"
          [class.active]="step === steps[i]"
          [attr.aria-current]="step === steps[i] ? 'step' : null"
          >{{ i + 1 }}. {{ label }}</a
        >
      }
    </nav>
    @if (s.workspace()!.preferences.onboarding === 3) {
      <section class="panel padded">
        <h2>Your workspace is ready</h2>
        <p>Your balances and preferences have been saved.</p>
        <a routerLink="/overview" class="button primary">Go to overview</a>
      </section>
    } @else if (step === "preferences") {
      <div class="settings-layout">
        <section class="panel form-panel">
          <form [formGroup]="preferences" (ngSubmit)="savePreferences()">
            <h2>Start with your preferences</h2>
            <div class="form-grid">
              <label
                >Display currency<select formControlName="currency">
                  @for (c of s.state()?.currencies; track c) {
                    <option>{{ c }}</option>
                  }
                </select></label
              ><label
                >Time zone<input
                  formControlName="timeZone"
                  placeholder="Europe/London"
              /></label>
            </div>
            <h3 class="section-gap">
              What interests you? <span class="muted">(optional)</span>
            </h3>
            <div class="interest-options">
              @for (interest of interests; track interest) {
                <button
                  type="button"
                  class="button secondary"
                  [class.selected]="selectedInterests.includes(interest)"
                  [attr.aria-pressed]="selectedInterests.includes(interest)"
                  (click)="toggleInterest(interest)"
                >
                  {{ interest }}
                  @if (selectedInterests.includes(interest)) {
                    <av-icon name="check" />
                  }
                </button>
              }
            </div>
            @if (preferencesConflict) {
              <div class="callout" role="status">
                <p>
                  Preferences changed. Your unsaved choices remain here. Load
                  the latest preferences to discard them and review the saved
                  values.
                </p>
                <button
                  type="button"
                  class="button secondary"
                  [disabled]="s.busy() || loadingPreferences"
                  (click)="reloadPreferences()"
                >
                  Load latest preferences
                </button>
              </div>
            }
            <div class="form-actions">
              <button
                class="button primary"
                [disabled]="
                  s.busy() || preferencesConflict || loadingPreferences
                "
              >
                Save & continue <av-icon name="arrow" />
              </button>
            </div>
          </form>
        </section>
        <aside class="panel padded">
          <h2>Display is not conversion</h2>
          <p>
            Your display currency changes how you see your portfolio. Each
            transaction keeps its original currency. Missing exchange rates
            remain visible as gaps.
          </p>
          <p>
            Interests help organize relevant information. They never change a
            hidden recommendation score.
          </p>
        </aside>
      </div>
    } @else if (step === "portfolio") {
      <section class="panel form-panel narrow">
        <form [formGroup]="portfolio" (ngSubmit)="createPortfolio()">
          <h2>A name for your investment picture</h2>
          <div class="form-grid">
            <label
              >Portfolio name<input
                formControlName="name"
                maxlength="60"
                placeholder="e.g. Long-term investments"
                required /></label
            ><label
              >Accounting currency<select formControlName="currency">
                @for (c of s.state()?.currencies; track c) {
                  <option>{{ c }}</option>
                }
              </select></label
            >
          </div>
          <div class="form-actions">
            <a routerLink="/onboarding/preferences" class="button secondary"
              >Back</a
            ><button class="button primary" [disabled]="s.busy()">
              Create & continue <av-icon name="arrow" />
            </button>
          </div>
        </form>
      </section>
    } @else {
      <section class="panel form-panel">
        <form [formGroup]="balances" (ngSubmit)="finish()">
          <h2>Start from where you are</h2>
          <p class="muted">
            Opening cash becomes a deposit. Opening holdings establish existing
            shares without a cash debit. You can leave both empty and add
            transactions later.
          </p>
          <fieldset [disabled]="saving" class="opening-fields">
            <div class="form-grid">
              <label
                >Opening date<input
                  type="date"
                  formControlName="date"
                  [max]="today"
                  required /></label
              ><label
                >Opening cash ({{ accountingCurrency() }})<input
                  formControlName="cash"
                  inputmode="decimal"
                  placeholder="0.00"
              /></label>
            </div>
            <div formArrayName="holdings">
              @for (row of holdings.controls; track row; let i = $index) {
                <section class="opening-row" [formGroupName]="i">
                  <div class="inline-between">
                    <h3>Opening holding {{ i + 1 }}</h3>
                    <button
                      type="button"
                      class="button text danger"
                      [attr.aria-label]="'Remove opening holding ' + (i + 1)"
                      (click)="removeHolding(i)"
                    >
                      Remove
                    </button>
                  </div>
                  <div class="form-grid">
                    <label
                      >Asset<select formControlName="assetId">
                        <option value="">Choose a listing</option>
                        @for (a of s.assets(); track a.id) {
                          <option [value]="a.id">
                            {{ a.symbol }} · {{ a.name }} · {{ a.exchange }}
                          </option>
                        }
                      </select></label
                    ><label
                      >Quantity<input
                        formControlName="quantity"
                        inputmode="decimal" /></label
                    ><label class="check-label"
                      ><input type="checkbox" formControlName="basisUnknown" />I
                      don’t know the cost basis</label
                    >
                    @if (!row.controls.basisUnknown.value) {
                      <label
                        >Cost per share, including fees ({{
                          s.asset(row.controls.assetId.value)?.currency ||
                            "quote currency"
                        }})<input formControlName="price" inputmode="decimal"
                      /></label>
                    }
                    <label
                      >Acquisition date (optional)<input
                        type="date"
                        formControlName="acquiredAt"
                        [max]="balances.controls.date.value"
                      /><small
                        >Leave blank to explicitly record an unknown acquisition
                        date.</small
                      ></label
                    >
                  </div>
                  @if (row.controls.basisUnknown.value) {
                    <p class="callout">
                      Value is available. Cost and gains remain unavailable
                      until you provide the missing basis.
                    </p>
                  }
                </section>
              }
            </div>
            <button
              type="button"
              class="button secondary section-gap"
              (click)="addHolding()"
              [disabled]="holdings.length >= 500"
            >
              <av-icon name="plus" />Add opening holding
            </button>
          </fieldset>
          <div class="callout">
            <av-icon name="info" />
            <p>
              Save a draft to resume after refresh. Finishing saves opening
              cash, holdings, and audit history together. Available market
              prices are labeled throughout.
            </p>
          </div>
          <div class="form-actions">
            <button
              type="button"
              class="button secondary"
              (click)="saveDraft()"
              [disabled]="s.busy()"
            >
              Save draft</button
            ><button class="button primary" [disabled]="s.busy()">
              {{ saving ? "Retry setup save" : "Finish setup" }}
              <av-icon name="arrow" />
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class OnboardingPage {
  s = inject(Store);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  steps = ["preferences", "portfolio", "holdings"];
  labels = ["Preferences", "Your portfolio", "Opening balances"];
  step = "preferences";
  today = new Date().toISOString().slice(0, 10);
  saving = false;
  pending: { revision: number; draft: OpeningDraft } | null = null;
  key = crypto.randomUUID();
  interests = INTERESTS;
  preferencesConflict = false;
  loadingPreferences = false;
  preferencesSnapshot = structuredClone(this.s.workspace()!.preferences);
  selectedInterests = [...this.s.workspace()!.preferences.interests];
  preferences = this.fb.nonNullable.group({
    currency: [this.s.workspace()!.preferences.currency],
    timeZone: [this.s.workspace()!.preferences.timeZone],
  });
  portfolio = this.fb.nonNullable.group({
    name: [""],
    currency: [this.s.workspace()!.preferences.currency],
  });
  balances = this.fb.nonNullable.group({
    date: [this.today],
    cash: ["0"],
    holdings: this.fb.array<ReturnType<OnboardingPage["holdingForm"]>>([]),
  });
  get holdings() {
    return this.balances.controls.holdings;
  }
  holdingForm() {
    return this.fb.nonNullable.group({
      assetId: [""],
      quantity: ["1"],
      price: [""],
      basisUnknown: [false],
      acquiredAt: [""],
    });
  }
  constructor() {
    const saved = this.s.workspace()!.onboarding?.draft;
    if (saved) {
      this.balances.patchValue({ date: saved.date, cash: saved.cash });
      for (const h of saved.holdings) {
        const form = this.holdingForm();
        form.patchValue({ ...h, acquiredAt: h.acquiredAt || "" });
        this.holdings.push(form);
      }
    }
    this.route.paramMap.subscribe((p) => {
      const progress = this.s.workspace()!.preferences.onboarding;
      const requested = p.get("step") || "";
      const allowed = this.steps[Math.min(progress, 2)];
      this.step =
        this.steps.includes(requested) &&
        this.steps.indexOf(requested) <= progress
          ? requested
          : allowed;
      if (progress === 2 && this.step === "portfolio") this.step = "holdings";
      if (this.step !== requested)
        void this.router.navigate(["/onboarding", this.step], {
          replaceUrl: true,
        });
    });
  }
  get dirty() {
    return (
      this.preferences.dirty || this.portfolio.dirty || this.balances.dirty
    );
  }
  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    e: BeforeUnloadEvent,
  ) {
    if (this.dirty) e.preventDefault();
  }
  toggleInterest(value: string) {
    this.selectedInterests = this.selectedInterests.includes(value)
      ? this.selectedInterests.filter((x) => x !== value)
      : [...this.selectedInterests, value];
    this.preferences.markAsDirty();
  }
  loadPreferences() {
    this.preferencesSnapshot = structuredClone(this.s.workspace()!.preferences);
    this.preferences.reset({
      currency: this.preferencesSnapshot.currency,
      timeZone: this.preferencesSnapshot.timeZone,
    });
    this.selectedInterests = [...this.preferencesSnapshot.interests];
    this.preferencesConflict = false;
  }
  async reloadPreferences() {
    if (this.s.busy() || this.loadingPreferences) return;
    this.loadingPreferences = true;
    const owner = this.s.user()?.id;
    await this.s.refresh();
    if (!this.s.error() && this.s.user()?.id === owner) this.loadPreferences();
    this.loadingPreferences = false;
  }
  async savePreferences() {
    if (this.preferencesConflict || this.loadingPreferences || this.s.busy())
      return;
    const result = await this.s.mutate(
      "/me/preferences",
      "PATCH",
      {
        ...this.preferencesSnapshot,
        ...this.preferences.getRawValue(),
        interests: this.selectedInterests,
        onboarding: 1,
      },
      "Preferences saved",
    );
    if (result) {
      this.preferencesSnapshot = structuredClone(
        this.s.workspace()!.preferences,
      );
      this.preferences.markAsPristine();
      await this.router.navigate([
        "/onboarding",
        this.s.workspace()!.onboarding?.portfolioId ? "holdings" : "portfolio",
      ]);
    } else if (this.s.lastErrorStatus === 409) {
      this.preferencesConflict = true;
    }
  }
  async createPortfolio() {
    const result = await this.s.mutate(
      "/portfolios",
      "POST",
      { ...this.portfolio.getRawValue(), onboarding: true },
      "Portfolio created",
    );
    if (result) {
      if (!this.preferences.dirty) this.loadPreferences();
      this.portfolio.markAsPristine();
      this.s.select(result.id);
      await this.router.navigateByUrl("/onboarding/holdings");
    }
  }
  addHolding() {
    this.holdings.push(this.holdingForm());
    this.balances.markAsDirty();
  }
  removeHolding(i: number) {
    this.holdings.removeAt(i);
    this.balances.markAsDirty();
  }
  accountingCurrency() {
    return this.s
      .portfolios()
      .find((p) => p.id === this.s.workspace()?.onboarding?.portfolioId)
      ?.currency;
  }
  draft(): OpeningDraft {
    const b = this.balances.getRawValue();
    return {
      ...b,
      holdings: b.holdings.map((h) => ({
        ...h,
        acquiredAt: h.acquiredAt || null,
      })),
    };
  }
  async saveDraft() {
    if (this.pending) {
      this.s.error.set(
        "Reconcile the pending setup save before changing its draft.",
      );
      return;
    }
    if (
      await this.s.mutate(
        "/onboarding/holdings-draft",
        "PUT",
        { revision: this.s.workspace()!.revision, draft: this.draft() },
        "Opening balances draft saved",
      )
    )
      this.balances.markAsPristine();
  }
  async finish() {
    this.pending ||= {
      revision: this.s.workspace()!.revision,
      draft: this.draft(),
    };
    this.saving = true;
    const p = await this.s.mutate(
      "/onboarding/complete",
      "POST",
      this.pending,
      "Setup complete. Your opening ledger is ready.",
      this.key,
    );
    if (p) {
      this.balances.markAsPristine();
      this.s.select(p.id);
      await this.router.navigateByUrl("/overview");
    } else if ([400, 404, 409, 422].includes(this.s.lastErrorStatus)) {
      this.pending = null;
      this.saving = false;
      this.key = crypto.randomUUID();
    }
  }
}
