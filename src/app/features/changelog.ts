import { Component, signal } from "@angular/core";
import { parseChangelog, NoteBlock } from "../domain/changelog";

@Component({
  standalone: true,
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">THE DETAILS BEHIND THE PROGRESS</span>
        <h1>What's new in Avenor<span class="accent">.</span></h1>
        <p>Changes, screenshots, and what they mean for your workspace.</p>
        @if (currentVersion()) {
          <div class="release-version">
            <strong>{{ currentVersion() }}</strong
            ><span class="badge">Development build</span>
          </div>
        }
      </div>
      <a
        class="button secondary"
        href="https://github.com/orKonijn/Avenor/blob/main/CHANGELOG.md"
        target="_blank"
        rel="noopener"
        >View on GitHub</a
      >
    </div>
    @if (error()) {
      <section class="panel padded" role="alert">
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Try again</button>
      </section>
    }
    @if (loading()) {
      <p role="status">Loading release notes…</p>
    }
    @if (blocks().length) {
      <div class="release-layout">
        <nav class="panel release-index" aria-label="Changelog sections">
          <strong>In this update</strong>
          @for (b of blocks(); track $index) {
            @if (b.kind === "heading" && b.level === 3) {
              <a [href]="'/changelog#' + b.id" (click)="jump($event, b.id!)">{{
                b.text
              }}</a>
            }
          }
        </nav>
        <article class="panel release-notes" aria-label="Release notes">
          @for (b of blocks(); track $index) {
            @switch (b.kind) {
              @case ("heading") {
                @switch (b.level) {
                  @case (2) {
                    <h2 [id]="b.id">{{ b.text }}</h2>
                  }
                  @case (3) {
                    <h3 [id]="b.id">{{ b.text }}</h3>
                  }
                  @default {
                    <h4 [id]="b.id">{{ b.text }}</h4>
                  }
                }
              }
              @case ("paragraph") {
                <p>{{ b.text }}</p>
              }
              @case ("list") {
                <ul>
                  @for (item of b.items; track $index) {
                    <li>{{ item }}</li>
                  }
                </ul>
              }
              @case ("image") {
                <figure>
                  <a
                    [href]="b.src"
                    target="_blank"
                    rel="noopener"
                    [attr.aria-label]="'Open full-size screenshot: ' + b.text"
                    ><img [src]="b.src" [alt]="b.text" loading="lazy"
                  /></a>
                  <figcaption>
                    {{ b.caption }}
                    <a [href]="b.src" target="_blank" rel="noopener"
                      >Open full size</a
                    >
                  </figcaption>
                </figure>
              }
            }
          }
        </article>
      </div>
    }
  `,
})
export class ChangelogPage {
  jump(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView();
  }
  currentVersion() {
    return (
      this.blocks().find(
        (b) =>
          b.kind === "paragraph" && b.text?.startsWith("Current app version:"),
      )?.text || ""
    );
  }
  blocks = signal<NoteBlock[]>([]);
  loading = signal(false);
  error = signal("");
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set("");
    try {
      const r = await fetch("/changelog/CHANGELOG.md");
      if (!r.ok) throw new Error();
      const text = await r.text();
      if (!/^## .*Unreleased/m.test(text)) throw new Error();
      this.blocks.set(parseChangelog(text));
    } catch {
      this.error.set("Release notes could not be loaded. Please try again.");
    } finally {
      this.loading.set(false);
    }
  }
}
