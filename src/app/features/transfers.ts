import {
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store } from "../core/store";

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">KEEP YOUR CASH CONNECTED</span>
        <h1>Transfer between portfolios<span class="accent">.</span></h1>
        <p>One movement, two linked records. Your total cash stays the same.</p>
      </div>
      <a class="button secondary" routerLink="/portfolios"
        >Back to portfolios</a
      >
    </div>
    @if (id()) {
      @if (debit(); as d) {
        <section class="panel padded narrow">
          <span class="badge">{{
            d.voided ? "Voided transfer" : "Recorded transfer"
          }}</span>
          <h2>{{ s.money(d.price, d.currency) }}</h2>
          <dl>
            <dt>From</dt>
            <dd>{{ name(d.portfolioId) }}</dd>
            <dt>To</dt>
            <dd>{{ name(credit()?.portfolioId || "") }}</dd>
            <dt>Recorded time (UTC)</dt>
            <dd>{{ d.effectiveAt }}</dd>
            <dt>Note</dt>
            <dd>{{ d.note || "No note" }}</dd>
          </dl>
          <div class="inline-controls">
            <a
              class="button secondary"
              [routerLink]="portfolioLink(d.portfolioId)"
              >View source records</a
            ><a
              class="button secondary"
              [routerLink]="portfolioLink(credit()?.portfolioId || '')"
              >View destination records</a
            >
          </div>
          <p>
            To correct a transfer, void both linked records, then record a
            replacement. Voiding is unavailable if either portfolio is archived
            or later transactions depend on this cash.
          </p>
          @if (!d.voided) {
            <button
              class="button secondary danger"
              (click)="voidPair()"
              [disabled]="s.busy()"
            >
              Void transfer
            </button>
          }
          @if (!voidPending) {
            <a class="button primary" routerLink="/transfers/new"
              >New transfer</a
            >
          }
          @if (voidPending) {
            <p role="status">
              The void outcome is uncertain. Retry Void transfer to reconcile
              the same request.
            </p>
          }
        </section>
      } @else {
        <section class="panel padded">
          <h2>Transfer unavailable</h2>
          <p>This transfer is not in your workspace.</p>
        </section>
      }
    } @else {
      <section class="panel form-panel">
        <h2>Move cash</h2>
        @if (s.portfolios().length < 2) {
          <p>Create two active portfolios before transferring cash.</p>
          <a routerLink="/portfolios/new" class="button secondary"
            >Create portfolio</a
          >
        }
        <form [formGroup]="form" (ngSubmit)="submit()">
          <fieldset [disabled]="!!pending || s.busy()" class="transfer-fields">
            <div class="form-grid">
              <label
                >From portfolio<select formControlName="sourcePortfolioId">
                  @for (p of s.portfolios(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select></label
              >
              <label
                >To portfolio<select formControlName="destinationPortfolioId">
                  <option value="">Choose a destination</option>
                  @for (p of s.portfolios(); track p.id) {
                    <option [value]="p.id">{{ p.name }}</option>
                  }
                </select></label
              >
              <label
                >Cash currency<select formControlName="currency">
                  @for (c of s.state()?.currencies; track c) {
                    <option>{{ c }}</option>
                  }
                </select></label
              >
              <label
                >Transfer amount<input
                  formControlName="amount"
                  inputmode="decimal"
                  required
              /></label>
              <label
                >Transfer date (UTC)<input
                  type="date"
                  formControlName="date"
                  required
              /></label>
              <label
                >Note (optional)<input formControlName="note" maxlength="500"
              /></label>
            </div>
          </fieldset>
          <div class="callout">
            <p>
              Both portfolios use the same cash currency for this movement. No
              exchange or fee is included; record those separately. Each
              portfolio treats the movement as a contribution or withdrawal. The
              combined portfolio excludes the matched pair from external flows.
            </p>
          </div>
          @if (pending) {
            <p role="status">
              The save outcome is uncertain. Retry this same transfer before
              changing its details.
            </p>
          }
          <div class="form-actions">
            <button
              class="button primary"
              [disabled]="s.busy() || s.portfolios().length < 2"
            >
              {{ pending ? "Retry transfer" : "Record transfer" }}
            </button>
          </div>
        </form>
      </section>
    }
  `,
})
export class TransfersPage {
  s = inject(Store);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  router = inject(Router);
  id = signal<string | null>(null);
  pending: any = null;
  key = crypto.randomUUID();
  voidKey = crypto.randomUUID();
  voidPending: any = null;
  form = this.fb.nonNullable.group({
    sourcePortfolioId: [
      this.s.portfolios().find((p) => p.id === this.s.selected())?.id ||
        this.s.portfolios()[0]?.id ||
        "",
    ],
    destinationPortfolioId: [""],
    currency: ["USD"],
    amount: [""],
    date: [new Date().toISOString().slice(0, 10)],
    note: [""],
  });
  debit = computed(() =>
    this.s
      .workspace()
      ?.transactions.find(
        (t) => t.transferId === this.id() && t.type === "withdrawal",
      ),
  );
  credit = computed(() =>
    this.s
      .workspace()
      ?.transactions.find(
        (t) => t.transferId === this.id() && t.type === "deposit",
      ),
  );
  constructor() {
    this.route.paramMap.subscribe((p) => {
      const id = p.get("id");
      const next = id === "new" ? null : id;
      if ((this.pending || this.voidPending) && next !== this.id()) {
        this.s.error.set(
          "Reconcile the pending transfer operation before switching receipts.",
        );
        void this.router.navigate(["/transfers", this.id() || "new"], {
          replaceUrl: true,
        });
        return;
      }
      this.id.set(next);
    });
  }
  get dirty() {
    return this.form.dirty || !!this.pending || !!this.voidPending;
  }
  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    e: BeforeUnloadEvent,
  ) {
    if (this.dirty) e.preventDefault();
  }
  name(id: string) {
    return (
      this.s.workspace()?.portfolios.find((p) => p.id === id)?.name ||
      "Unavailable"
    );
  }
  portfolioLink(id: string) {
    return this.s.workspace()?.portfolios.find((p) => p.id === id)?.archived
      ? ["/portfolios/archived", id]
      : ["/portfolios", id, "transactions"];
  }
  async submit() {
    if (!this.pending) {
      const v = this.form.getRawValue();
      const source = this.s
          .portfolios()
          .find((p) => p.id === v.sourcePortfolioId),
        destination = this.s
          .portfolios()
          .find((p) => p.id === v.destinationPortfolioId);
      if (!source || !destination || source.id === destination.id) {
        this.s.error.set("Choose two different active portfolios.");
        return;
      }
      if (
        !confirm(
          "Record this cash transfer? Both portfolios will be updated together.",
        )
      )
        return;
      this.pending = {
        ...v,
        effectiveAt: v.date + "T00:00:00.000Z",
        sourceRevision: source.revision,
        destinationRevision: destination.revision,
      };
    }
    const result = await this.s.mutate(
      "/transfers",
      "POST",
      this.pending,
      "Transfer recorded in both portfolios",
      this.key,
    );
    if (result) {
      this.pending = null;
      this.key = crypto.randomUUID();
      this.form.markAsPristine();
      await this.router.navigate(["/transfers", result.id]);
    } else if ([400, 404, 409, 422].includes(this.s.lastErrorStatus)) {
      this.pending = null;
      this.key = crypto.randomUUID();
    }
  }
  async voidPair() {
    if (!this.voidPending) {
      if (
        !confirm(
          "Void both sides of this transfer? Both ledgers will be revalidated.",
        )
      )
        return;
      const source = this.s
          .workspace()
          ?.portfolios.find((p) => p.id === this.debit()?.portfolioId),
        destination = this.s
          .workspace()
          ?.portfolios.find((p) => p.id === this.credit()?.portfolioId);
      this.voidPending = {
        id: this.id(),
        sourceRevision: source?.revision,
        destinationRevision: destination?.revision,
      };
    }
    const result = await this.s.mutate(
      "/transfers/" + this.voidPending.id + "/void",
      "POST",
      this.voidPending,
      "Both transfer records voided",
      this.voidKey,
    );
    if (result || [400, 404, 409, 422].includes(this.s.lastErrorStatus)) {
      this.voidPending = null;
      this.voidKey = crypto.randomUUID();
    }
  }
}
