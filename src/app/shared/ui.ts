import { Component, input, computed } from "@angular/core";
@Component({
  selector: "av-icon",
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="path()" />
  </svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class Icon {
  name = input("grid");
  path = computed(
    () =>
      (
        ({
          grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
          portfolio: "M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
          chart: "M4 3v17h17 M8 15l4-5 4 2 5-7",
          compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 8l-3 5-5 3 3-5z",
          star: "m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1z",
          bell: "M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10 M10 21h4",
          settings:
            "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
          search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
          plus: "M12 5v14 M5 12h14",
          arrow: "M5 12h14 M13 6l6 6-6 6",
          chevron: "m9 5 7 7-7 7",
          moon: "M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10",
          sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1",
          logout: "M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4",
          info: "M12 11v6 M12 7h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
          check: "m5 12 4 4L19 6",
          close: "m6 6 12 12 M6 18 18 6",
          up: "m5 16 6-7 4 3 5-7 M15 5h5v5",
          down: "m5 8 6 7 4-3 5 7 M15 19h5v-5",
          filter: "M4 6h16 M7 12h10 M10 18h4",
          more: "M5 12h.01 M12 12h.01 M19 12h.01",
          book: "M4 4h6l2 2 2-2h6v16h-6l-2 1-2-1H4z M12 6v15",
          shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z",
          clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
        }) as Record<string, string>
      )[this.name()] || "M5 12h14",
  );
}
@Component({
  selector: "av-logo",
  standalone: true,
  template: `<span class="brand-mark"
      ><svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M8 31 19 8h6L14 31zm15-12 10 12h-8l-5-6z"
          fill="currentColor"
        /></svg></span
    ><span>Avenor<span class="brand-dot">.</span></span>`,
  styles: [
    `
      :host {
        display: flex;
        gap: 10px;
        align-items: center;
        font-size: 25px;
        font-weight: 800;
        letter-spacing: -1px;
      }
      .brand-mark {
        width: 36px;
        height: 36px;
        background: var(--accent);
        color: var(--on-accent);
        border-radius: 10px;
      }
      .brand-dot {
        color: var(--accent);
      }
    `,
  ],
})
export class Logo {}
@Component({
  selector: "av-source",
  standalone: true,
  imports: [Icon],
  template: `<div class="source-line">
    <av-icon name="info" /><span>{{ text() }}</span>
  </div>`,
})
export class Source {
  text = input("Sample data · 28 Oct 2026, 16:00 UTC · USD · not a live quote");
}
@Component({
  selector: "av-empty",
  standalone: true,
  imports: [Icon],
  template: `<div class="empty">
    <span class="empty-icon"><av-icon [name]="icon()" /></span>
    <h3>{{ title() }}</h3>
    <p>{{ description() }}</p>
    <ng-content />
  </div>`,
})
export class Empty {
  icon = input("portfolio");
  title = input("A fresh start");
  description = input("Your next step starts here.");
}
