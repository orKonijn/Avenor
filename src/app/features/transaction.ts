import { Component, inject, HostListener } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Icon } from "../shared/ui";
import { D, replay } from "../domain/ledger";
import { Transaction } from "../domain/models";
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  template: `<a routerLink="/portfolios" class="back-link"
      >← Back to portfolios</a
    >
    <div class="page-heading">
      <div>
        <span class="eyebrow">KEEP YOUR PICTURE UP TO DATE</span>
        <h1>
          {{ editing ? "Edit transaction" : "Add a transaction"
          }}<span class="accent">.</span>
        </h1>
        <p>A clear record is the foundation of a clear perspective.</p>
      </div>
      <span class="badge">{{
        s.user()?.demo ? "Isolated sample ledger" : "Manual entry"
      }}</span>
    </div>
    <div class="transaction-layout">
      <section class="panel form-panel">
        <form [formGroup]="form" (ngSubmit)="submit()">
          <h2>Transaction details</h2>
          <fieldset class="form-grid" [disabled]="pending !== null">
            <label
              >Portfolio<select formControlName="portfolioId">
                <option value="">Choose a portfolio</option>
                @for (p of s.portfolios(); track p.id) {
                  <option [value]="p.id">{{ p.name }}</option>
                }
              </select></label
            ><label
              >Transaction type<select formControlName="type">
                @for (t of types; track t) {
                  <option [value]="t">
                    {{ t.charAt(0).toUpperCase() + t.slice(1) }}
                  </option>
                }
              </select></label
            >
            @if (needsAsset()) {
              <label class="span-2"
                >Asset<select formControlName="assetId">
                  <option value="">Choose an asset</option>
                  @for (a of s.assets(); track a.id) {
                    <option [value]="a.id">
                      {{ a.symbol }} · {{ a.name }} · {{ a.exchange }}
                    </option>
                  }
                </select></label
              >
            }
            <label
              >Effective date<input
                type="date"
                formControlName="date"
                [max]="today" /></label
            ><label
              >Currency<select formControlName="currency">
                @for (c of s.state()?.currencies; track c) {
                  <option>{{ c }}</option>
                }
              </select></label
            ><label
              >{{
                form.controls.type.value === "split"
                  ? "Split multiplier"
                  : "Quantity"
              }}<input
                formControlName="quantity"
                inputmode="decimal"
                placeholder="1"
              /><small>{{
                form.controls.type.value === "split"
                  ? "Enter 2 for a 2-for-1 split."
                  : needsAsset()
                    ? "Fractional shares supported."
                    : "Use 1 and enter the total amount below."
              }}</small></label
            >
            @if (form.controls.type.value !== "split") {
              <label
                >{{ needsAsset() ? "Price per unit" : "Amount per unit"
                }}<input
                  formControlName="price"
                  inputmode="decimal"
                  placeholder="0.00" /></label
              ><label
                >Fee<input
                  formControlName="fee"
                  inputmode="decimal"
                  placeholder="0.00"
              /></label>
            }
            @if (form.controls.type.value === "fx") {
              <label
                >Destination currency<select
                  formControlName="destinationCurrency"
                >
                  @for (c of s.state()?.currencies; track c) {
                    <option>{{ c }}</option>
                  }
                </select></label
              ><label
                >Execution rate<input
                  formControlName="rate"
                  inputmode="decimal"
                /><small>Destination units per source unit.</small></label
              >
            }
            <label class="span-2"
              >Note <span class="muted">(optional)</span
              ><textarea
                formControlName="note"
                rows="3"
                maxlength="500"
                placeholder="A little context for your future self…"
              ></textarea>
            </label>
          </fieldset>
          @if (localError) {
            <div
              class="banner error"
              role="alert"
              tabindex="-1"
              id="form-error"
            >
              {{ localError }}
            </div>
          }
          <div class="form-actions">
            <a routerLink="/portfolios" class="button secondary">Cancel</a
            ><button
              class="button primary"
              [disabled]="s.busy() || !s.portfolios().length"
            >
              {{
                s.busy()
                  ? "Saving…"
                  : pending
                    ? "Retry original save"
                    : editing
                      ? "Save revision"
                      : "Review & save"
              }}<av-icon name="arrow" />
            </button>
          </div>
        </form>
      </section>
      <aside>
        <section class="panel transaction-preview">
          <div class="eyebrow">BEFORE YOU SAVE</div>
          <h2>Your transaction, at a glance</h2>
          <dl>
            <dt>Transaction</dt>
            <dd>{{ form.controls.type.value }}</dd>
            <dt>Gross amount</dt>
            <dd>{{ s.money(gross(), form.controls.currency.value) }}</dd>
            <dt>Fee</dt>
            <dd>
              {{
                s.money(form.controls.fee.value, form.controls.currency.value)
              }}
            </dd>
            <dt>Cash impact</dt>
            <dd>{{ cashImpact() }}</dd>
            @if (form.controls.type.value === "fx") {
              <dt>Destination credit</dt>
              <dd>{{ fxCredit() }}</dd>
            }
            <dt>Ledger revision</dt>
            <dd>{{ portfolio()?.revision ?? "—" }}</dd>
          </dl>
          <div class="callout">
            <av-icon name="shield" />
            <p>
              Every change is validated against your full ledger. Your
              transaction and audit history are saved together.
            </p>
          </div>
        </section>
        <p class="form-footnote">
          Recording a transaction does not place an order or move money.
        </p>
        @if (!s.portfolios().length) {
          <a routerLink="/portfolios/new" class="button primary"
            >Create a portfolio first</a
          >
        }
      </aside>
    </div>`,
})
export class TransactionPage {
  s = inject(Store);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  today = new Date().toISOString().slice(0, 10);
  editing = this.route.snapshot.paramMap.get("id");
  saved = false;
  localError = "";
  pending: Transaction | null = null;
  key = crypto.randomUUID();
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
  form = this.fb.nonNullable.group({
    portfolioId: ["", Validators.required],
    type: ["buy", Validators.required],
    assetId: [""],
    date: [this.today, Validators.required],
    currency: ["USD"],
    quantity: ["1", Validators.required],
    price: ["", Validators.required],
    fee: ["0"],
    destinationCurrency: ["EUR"],
    rate: ["1"],
    note: [""],
  });
  constructor() {
    const draft = this.s.draft();
    const old = this.s
      .workspace()
      ?.transactions.find((t) => t.id === this.editing);
    if (old) {
      this.form.patchValue({ ...old, date: old.effectiveAt.slice(0, 10) });
      this.form.controls.portfolioId.disable();
    } else
      this.form.controls.portfolioId.setValue(
        this.route.snapshot.queryParamMap.get("portfolioId") ||
          (this.s.selected() !== "all"
            ? this.s.selected()
            : this.s.portfolios()[0]?.id) ||
          "",
      );
    if (
      draft?.ownerId === this.s.user()?.id &&
      draft.editing === this.editing
    ) {
      this.form.patchValue(draft.form);
      this.pending = draft.pending || null;
      this.key = draft.key || this.key;
      this.form.markAsDirty();
    }
    this.form.controls.type.valueChanges.subscribe((t) => {
      if (t === "split") {
        this.form.controls.price.setValue("0");
        this.form.controls.fee.setValue("0");
      }
    });
    this.form.controls.assetId.valueChanges.subscribe((id) => {
      const a = this.s.asset(id);
      if (a) this.form.controls.currency.setValue(a.currency);
    });
  }
  needsAsset() {
    return ["buy", "sell", "dividend", "split"].includes(
      this.form.controls.type.value,
    );
  }
  portfolio() {
    return this.s
      .portfolios()
      .find((p) => p.id === this.form.controls.portfolioId.value);
  }
  gross() {
    try {
      return D(this.form.controls.quantity.value)
        .mul(this.form.controls.price.value || 0)
        .toString();
    } catch {
      return null;
    }
  }
  cashImpact() {
    try {
      const t = this.form.controls.type.value;
      if (t === "split") return "No cash movement";
      const gross = D(this.gross() || 0),
        fee = D(this.form.controls.fee.value || 0);
      const debit = ["buy", "withdrawal", "fee", "fx"].includes(t);
      return `${debit ? "−" : "+"}${this.s.money(debit ? gross.plus(fee).toString() : gross.minus(fee).toString(), this.form.controls.currency.value)}`;
    } catch {
      return "Enter valid amounts";
    }
  }
  fxCredit() {
    try {
      return this.s.money(
        D(this.gross() || 0)
          .mul(this.form.controls.rate.value)
          .toString(),
        this.form.controls.destinationCurrency.value,
      );
    } catch {
      return "—";
    }
  }
  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    e: BeforeUnloadEvent,
  ) {
    if (this.form.dirty && !this.saved) e.preventDefault();
  }
  async submit() {
    if (this.pending) {
      await this.persist(this.pending);
      return;
    }
    this.localError = "";
    const v = this.form.getRawValue(),
      p = this.portfolio();
    if (!p) {
      this.localError = "Choose a portfolio.";
      return;
    }
    const old = this.s
      .workspace()
      ?.transactions.find((t) => t.id === this.editing);
    const t = {
      ...v,
      id: old?.id || "preview",
      effectiveAt:
        old && old.effectiveAt.slice(0, 10) === v.date
          ? old.effectiveAt
          : v.date + "T00:00:00.000Z",
      revision: p.revision,
    } as unknown as Transaction;
    try {
      if (this.needsAsset() && !v.assetId) throw new Error("Choose an asset.");
      const records = this.s
        .workspace()!
        .transactions.filter((x) => x.portfolioId === p.id);
      replay(
        this.editing
          ? records.map((x) => (x.id === this.editing ? t : x))
          : [...records, t],
      );
    } catch (e) {
      this.localError = (e as Error).message;
      setTimeout(() => document.getElementById("form-error")?.focus());
      return;
    }
    if (
      !confirm(
        `${this.editing ? "Revise" : "Record"} ${v.type}? Cash impact: ${this.cashImpact()}${v.type === "fx" ? " / credit " + this.fxCredit() : ""}.`,
      )
    )
      return;
    this.pending = t;
    await this.persist(t);
  }
  async persist(t: Transaction) {
    this.s.draft.set({
      ownerId: this.s.user()?.id,
      editing: this.editing,
      form: this.form.getRawValue(),
      pending: t,
      key: this.key,
    });
    const result = await this.s.mutate(
      this.editing
        ? "/transactions/" + this.editing
        : "/portfolios/" + t.portfolioId + "/transactions",
      this.editing ? "PATCH" : "POST",
      t,
      "Transaction saved and ledger recalculated",
      this.key,
    );
    if (result) {
      this.saved = true;
      this.s.draft.set(null);
      this.form.markAsPristine();
      this.s.select(t.portfolioId);
      await this.router.navigate([
        "/portfolios",
        t.portfolioId,
        "transactions",
      ]);
    } else if ([400, 404, 409, 422].includes(this.s.lastErrorStatus)) {
      this.pending = null;
      this.key = crypto.randomUUID();
      this.s.draft.update((d) =>
        d?.ownerId === this.s.user()?.id
          ? { ...d, pending: null, key: this.key }
          : d,
      );
    } else {
      this.localError =
        "The save outcome is uncertain. Retry to reconcile the same request before making another change.";
    }
  }
}
