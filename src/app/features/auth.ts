import { Component, inject, signal } from "@angular/core";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Icon, Logo } from "../shared/ui";
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Icon, Logo],
  template: `<div class="auth-layout">
    <section class="auth-story">
      <av-logo />
      <div>
        <span class="eyebrow">A CLEARER VIEW OF YOUR INVESTMENTS</span>
        <h1>
          Your money.<br />Your direction.<br /><em>A little clarity.</em>
        </h1>
        <p>
          Bring your investments into focus.<br />Understand where you are, and
          see the bigger picture.
        </p>
        <div class="auth-art">
          <div class="orbit orbit-one"></div>
          <div class="orbit orbit-two"></div>
          <div class="floating-card">
            <span>Built for perspective</span
            ><strong>One thoughtful workspace.</strong>
            <div class="mini-bars">
              <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
            <small>Track · Understand · Explore</small>
          </div>
        </div>
      </div>
      <small>For the long view. Not the next trade.</small>
    </section>
    <section class="auth-form" id="main">
      <div class="auth-form-inner">
        <span class="eyebrow">WELCOME TO AVENOR</span>
        <h2>{{ title() }}</h2>
        <p class="muted">
          {{
            mode === "login"
              ? "A fresh perspective on everything you own."
              : mode === "register"
                ? "Make room for your financial picture."
                : "Let’s get you back to your workspace."
          }}
        </p>
        @if (s.error()) {
          <div class="banner error" role="alert">{{ s.error() }}</div>
        }
        @if (s.notice()) {
          <div class="banner success" role="status">{{ s.notice() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()">
          @if (mode === "register") {
            <label
              >Your name<input
                formControlName="name"
                autocomplete="name"
                placeholder="Alex Morgan"
            /></label>
          }
          @if (mode !== "reset" && mode !== "verify") {
            <label
              >Email address<input
                formControlName="email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
            /></label>
          }
          @if (mode === "login" || mode === "register" || mode === "reset") {
            <label
              >Password
              <div class="password-wrap">
                <input
                  formControlName="password"
                  [type]="show ? 'text' : 'password'"
                  [attr.autocomplete]="
                    mode === 'login' ? 'current-password' : 'new-password'
                  "
                  placeholder="Enter your password"
                /><button
                  type="button"
                  (click)="show = !show"
                  [attr.aria-label]="show ? 'Hide password' : 'Show password'"
                >
                  {{ show ? "Hide" : "Show" }}
                </button>
              </div></label
            >
            @if (mode === "register" || mode === "reset") {
              <small>Use at least 12 characters.</small>
            }
          }
          @if (mode === "register") {
            <label class="check-label"
              ><input type="checkbox" formControlName="terms" />I understand
              this app tracks investments and does not execute trades.</label
            >
          }
          @if (mode === "login") {
            <a routerLink="/auth/recover" class="forgot">Forgot password?</a>
          }
          <button class="button primary full" [disabled]="s.busy()">
            {{
              s.busy()
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : mode === "reset"
                      ? "Reset password"
                      : mode === "verify"
                        ? "Verify email"
                        : "Send recovery link"
            }}<av-icon name="arrow" />
          </button>
        </form>
        @if (authConfig().demo) {
          <div class="or-divider"><span>or take a look around</span></div>
          <button
            class="button secondary full"
            [disabled]="s.busy()"
            (click)="demo()"
          >
            Explore the sample workspace <av-icon name="arrow" />
          </button>
          <button
            class="button text full"
            [disabled]="s.busy()"
            (click)="emptyDemo()"
          >
            Start an empty sample workspace
          </button>
          <p class="auth-caption">
            No account needed. Sample data, real possibilities.
          </p>
        }
        @if (authConfig().private) {
          <p class="callout">
            Private personal workspace. Only the owner's approved email can
            register and sign in.
          </p>
        }
        <button class="button text full" (click)="resend()">
          Resend email verification
        </button>
        <p class="auth-switch">
          {{ mode === "login" ? "New here?" : "Already have an account?" }}
          <a
            [routerLink]="mode === 'login' ? '/auth/register' : '/auth/login'"
            >{{ mode === "login" ? "Create an account" : "Sign in" }}</a
          >
        </p>
        <div class="privacy-note">
          <av-icon name="shield" /><span
            >Private by design. Your financial picture stays yours.</span
          >
        </div>
      </div>
    </section>
  </div>`,
})
export class AuthPage {
  s = inject(Store);
  router = inject(Router);
  route = inject(ActivatedRoute);
  fb = inject(FormBuilder);
  authConfig = signal({ demo: false, registration: false, private: false });
  mode = "login";
  show = false;
  form = this.fb.nonNullable.group({
    name: [""],
    email: [""],
    password: [""],
    terms: [false],
  });
  constructor() {
    void this.s
      .request<{ demo: boolean; registration: boolean; private: boolean }>(
        "/auth/config",
      )
      .then((config) => this.authConfig.set(config))
      .catch(() => {});
    this.route.paramMap.subscribe((p) => {
      this.mode = p.get("mode") || "login";
      this.s.error.set("");
      this.s.notice.set("");
    });
  }
  title() {
    return (
      (
        {
          login: "Welcome back.",
          register: "Start with clarity.",
          recover: "Forgot your password?",
          reset: "Choose a new password.",
          verify: "Verify your email.",
        } as any
      )[this.mode] || "Welcome back."
    );
  }
  async resend() {
    await this.s.login("resend-verification", {
      email: this.form.controls.email.value,
    });
  }
  async emptyDemo() {
    if (await this.s.login("demo", { empty: true }))
      await this.router.navigateByUrl("/onboarding/preferences");
  }
  async demo() {
    if (await this.s.login("demo"))
      await this.router.navigateByUrl("/overview");
  }
  async submit() {
    const v = this.form.getRawValue();
    if (
      this.mode !== "verify" &&
      this.mode !== "reset" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)
    ) {
      this.s.error.set("Enter a valid email address.");
      return;
    }
    const data = await this.s.login(this.mode, {
      ...v,
      token: this.route.snapshot.queryParamMap.get("token"),
    });
    if (data?.user && this.s.draft()?.ownerId === data.user.id) {
      const draft = this.s.draft();
      await this.router.navigateByUrl(
        draft.editing
          ? `/transactions/${draft.editing}/edit`
          : "/transactions/new",
      );
    } else if (data?.user)
      await this.router.navigateByUrl(
        data.workspace.preferences.onboarding < 3
          ? "/onboarding/" +
              ["preferences", "portfolio", "holdings"][
                data.workspace.preferences.onboarding
              ]
          : "/overview",
      );
  }
}
