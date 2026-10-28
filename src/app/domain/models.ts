export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "buy"
  | "sell"
  | "dividend"
  | "fee"
  | "fx"
  | "opening"
  | "split";
export interface Transaction {
  id: string;
  portfolioId: string;
  type: TransactionType;
  effectiveAt: string;
  assetId?: string;
  quantity: string;
  price: string;
  fee: string;
  currency: string;
  note: string;
  destinationCurrency?: string;
  rate?: string;
  revision: number;
  voided?: boolean;
  basisUnknown?: boolean;
  acquiredAt?: string | null;
}
export interface Portfolio {
  id: string;
  name: string;
  currency: string;
  revision: number;
  archived: boolean;
}
export interface Asset {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  class: string;
  sector: string;
  geography: string;
  price: string | null;
  previousPrice: string | null;
  asOf: string;
  color: string;
  description: string;
}
export interface Lot {
  transactionId: string;
  quantity: string;
  basis: string | null;
  acquiredAt?: string | null;
}
export interface Position {
  assetId: string;
  quantity: string;
  basis: string | null;
  realized: string | null;
  lots: Lot[];
}
export interface Holding extends Position {
  asset: Asset;
  value: string | null;
  gain: string | null;
  weight: string | null;
  averageCost: string | null;
}
export interface Valuation {
  holdings: Holding[];
  cash: Record<string, string>;
  cashValue: string | null;
  value: string | null;
  knownValue: string;
  basis: string | null;
  gain: string | null;
  coverage: number;
  missing: string[];
  revision: number;
}
export interface Watchlist {
  id: string;
  name: string;
  items: string[];
}
export interface AlertRule {
  version?: number;
  kind?: "price" | "portfolio-value" | "portfolio-drawdown";
  portfolioId?: string;
  currency?: string;
  basis?: "quote-price" | "portfolio-value" | "close-to-close-net-flow";
  previousClose?: string | null;
  lastObservedAt?: string | null;
  id: string;
  assetId: string;
  direction: "above" | "below";
  threshold: string;
  cadence: "once" | "recurring";
  paused: boolean;
  previous: string | null;
  lastFired: string | null;
  state: string;
}
export interface Notification {
  portfolioId?: string;
  observedValue?: string;
  threshold?: string;
  observedAt?: string;
  currency?: string;
  provider?: string;
  delaySeconds?: number;
  id: string;
  ruleId: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  assetId: string;
}
export interface Theme {
  id: string;
  name: string;
  sector: string;
  description: string;
  assets: string[];
  color: string;
  thesis: string;
  counterpoint: string;
}
export interface Preferences {
  appearance: "light" | "dark" | "system";
  currency: string;
  locale: string;
  timeZone: string;
  interests: string[];
  onboarding: number;
  revision: number;
}
export interface User {
  id: string;
  email: string;
  name: string;
  demo: boolean;
  verified: boolean;
}
export interface Workspace {
  onboarding?: { portfolioId?: string; draft?: OpeningDraft };
  revision: number;
  portfolios: Portfolio[];
  transactions: Transaction[];
  watchlists: Watchlist[];
  alerts: AlertRule[];
  notifications: Notification[];
  preferences: Preferences;
  audit: {
    id: string;
    entityId: string;
    action: string;
    at: string;
    before: unknown;
    after: unknown;
  }[];
  followedThemes: string[];
}
export interface OpeningDraft {
  date: string;
  cash: string;
  holdings: {
    assetId: string;
    quantity: string;
    price: string;
    basisUnknown: boolean;
    acquiredAt: string | null;
  }[];
}
export interface Bootstrap {
  user: User;
  csrf: string;
  workspace: Workspace;
  assets: Asset[];
  themes: Theme[];
  currencies: string[];
  valuations: Record<string, Valuation>;
}
