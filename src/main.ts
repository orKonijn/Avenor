import { bootstrapApplication } from "@angular/platform-browser";
import { inject, provideAppInitializer } from "@angular/core";
import { provideRouter, Routes, Router } from "@angular/router";
import { App } from "./app/app";
import { Store } from "./app/core/store";
const guard = () =>
  inject(Store).user() ? true : inject(Router).parseUrl("/auth/login");
const routes: Routes = [
  {
    path: "auth/:mode",
    loadComponent: () => import("./app/features/auth").then((m) => m.AuthPage),
  },
  {
    path: "",
    canActivate: [guard],
    children: [
      {
        path: "overview",
        loadComponent: () =>
          import("./app/features/overview").then((m) => m.OverviewPage),
      },
      {
        path: "portfolios",
        loadComponent: () =>
          import("./app/features/portfolios").then((m) => m.PortfoliosPage),
      },
      {
        path: "portfolios/new",
        loadComponent: () =>
          import("./app/features/portfolios").then((m) => m.PortfoliosPage),
      },
      {
        path: "portfolios/:id/transactions",
        loadComponent: () =>
          import("./app/features/portfolios").then((m) => m.PortfoliosPage),
      },
      {
        path: "portfolios/:id/holdings/:assetId",
        loadComponent: () =>
          import("./app/features/explore").then((m) => m.AssetPage),
      },
      {
        path: "portfolios/:id",
        loadComponent: () =>
          import("./app/features/portfolios").then((m) => m.PortfoliosPage),
      },
      {
        path: "transactions/new",
        loadComponent: () =>
          import("./app/features/transaction").then((m) => m.TransactionPage),
        canDeactivate: [
          (c: any) =>
            !inject(Store).user() ||
            !c.form.dirty ||
            c.saved ||
            confirm("Discard your unsaved transaction?"),
        ],
      },
      {
        path: "transactions/:id/edit",
        loadComponent: () =>
          import("./app/features/transaction").then((m) => m.TransactionPage),
        canDeactivate: [
          (c: any) =>
            !inject(Store).user() ||
            !c.form.dirty ||
            c.saved ||
            confirm("Discard your unsaved transaction?"),
        ],
      },
      {
        path: "analysis",
        loadComponent: () =>
          import("./app/features/analysis").then((m) => m.AnalysisPage),
      },
      {
        path: "discover",
        loadComponent: () =>
          import("./app/features/explore").then((m) => m.DiscoverPage),
      },
      {
        path: "themes/:id",
        loadComponent: () =>
          import("./app/features/explore").then((m) => m.DiscoverPage),
      },
      {
        path: "assets/:id",
        loadComponent: () =>
          import("./app/features/explore").then((m) => m.AssetPage),
      },
      {
        path: "watchlists",
        loadComponent: () =>
          import("./app/features/organize").then((m) => m.WatchlistsPage),
      },
      {
        path: "watchlists/:id",
        loadComponent: () =>
          import("./app/features/organize").then((m) => m.WatchlistsPage),
      },
      {
        path: "alerts",
        loadComponent: () =>
          import("./app/features/alerts").then((m) => m.AlertsPage),
      },
      {
        path: "alerts/new",
        loadComponent: () =>
          import("./app/features/alerts").then((m) => m.AlertsPage),
      },
      {
        path: "alerts/:id/edit",
        loadComponent: () =>
          import("./app/features/alerts").then((m) => m.AlertsPage),
      },
      {
        path: "notifications",
        loadComponent: () =>
          import("./app/features/organize").then((m) => m.NotificationsPage),
      },
      {
        path: "settings/:section",
        loadComponent: () =>
          import("./app/features/settings").then((m) => m.SettingsPage),
      },
      {
        path: "onboarding/:step",
        loadComponent: () =>
          import("./app/features/onboarding").then((m) => m.OnboardingPage),
        canDeactivate: [
          (c: any) =>
            !inject(Store).user() ||
            !c.dirty ||
            confirm(
              "Discard unsaved setup changes? Saved drafts remain available.",
            ),
        ],
      },
      { path: "", pathMatch: "full", redirectTo: "overview" },
      {
        path: "**",
        loadComponent: () =>
          import("./app/features/settings").then((m) => m.NotFoundPage),
      },
    ],
  },
];
bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideAppInitializer(() => inject(Store).init()),
  ],
}).catch(console.error);
