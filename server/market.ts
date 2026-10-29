import { assets as sampleAssets, AS_OF } from "./sample";
import { Asset } from "../src/app/domain/models";
import Decimal from "decimal.js";

export interface MarketOptions {
  apiKey?: string;
  fetcher?: typeof fetch;
  now?: () => number;
  maxAgeMs?: number;
  pollIntervalMs?: number;
}
export function createMarket(options: MarketOptions = {}) {
  const apiKey = options.apiKey ?? process.env["TWELVE_DATA_API_KEY"] ?? "";
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const maxAge = options.maxAgeMs ?? 24 * 60 * 60_000;
  const interval = Math.max(15 * 60_000, options.pollIntervalMs ?? 15 * 60_000);
  const quotes = new Map<string, Asset>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  let pending = false;
  let position = 0;
  const mic = (a: Asset) => a.id.split("-").at(-1)!.toUpperCase();
  const empty = (a: Asset): Asset => ({
    ...a,
    price: null,
    previousPrice: null,
    asOf: "",
    source: "Twelve Data",
    dataStatus: "unavailable",
  });
  const price = (value: unknown) => {
    if (
      typeof value !== "string" ||
      !/^\d+(?:\.\d+)?$/.test(value) ||
      value.length > 64
    )
      throw new Error("Invalid quote");
    const n = new Decimal(value);
    if (!n.isFinite() || n.lte(0)) throw new Error("Invalid quote");
    return n.toFixed();
  };
  function assets(demo: boolean): Asset[] {
    if (demo) return sampleAssets;
    return sampleAssets.map((a) => {
      const q = quotes.get(a.id);
      return q && now() - Date.parse(q.asOf) <= maxAge ? { ...q } : empty(a);
    });
  }
  async function refreshOne(id: string) {
    const asset = sampleAssets.find((a) => a.id === id);
    if (!asset || !apiKey) return false;
    try {
      const url = new URL("https://api.twelvedata.com/quote");
      url.search = new URLSearchParams({
        symbol: asset.symbol,
        mic_code: mic(asset),
        apikey: apiKey,
      }).toString();
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Quote provider unavailable");
      const q = await response.json();
      const observed = q.last_quote_at * 1000;
      if (
        q.symbol !== asset.symbol ||
        q.mic_code !== mic(asset) ||
        q.currency !== asset.currency ||
        typeof q.last_quote_at !== "number" ||
        !Number.isFinite(observed) ||
        observed > now() + 60_000 ||
        now() - observed > maxAge
      )
        throw new Error("Quote identity or time unavailable");
      const old = quotes.get(id);
      if (old && observed < Date.parse(old.asOf))
        throw new Error("Out-of-order quote");
      quotes.set(id, {
        ...asset,
        price: price(q.close),
        previousPrice: price(q.previous_close),
        asOf: new Date(observed).toISOString(),
        source: "Twelve Data",
        dataStatus: "provider",
      });
      return true;
    } catch {
      // Never log provider URLs (they contain credentials), nor fall back to fixtures.
      quotes.delete(id);
      return false;
    }
  }
  async function tick() {
    if (stopped || pending) return;
    pending = true;
    try {
      await refreshOne(sampleAssets[position].id);
    } finally {
      pending = false;
    }
    position = (position + 1) % sampleAssets.length;
    if (!stopped) {
      timer = setTimeout(() => void tick(), position === 0 ? interval : 10_000);
      timer.unref();
    }
  }
  return {
    assets,
    refreshOne,
    metadata(demo: boolean) {
      if (demo)
        return {
          source: "Avenor synthetic fixture",
          asOf: AS_OF,
          dataStatus: "sample",
          delaySeconds: null,
        };
      const available = assets(false).filter((a) => a.price !== null);
      return {
        source: "Twelve Data",
        asOf: available.length ? available.map((a) => a.asOf).sort()[0] : null,
        dataStatus:
          available.length === sampleAssets.length ? "provider" : "unavailable",
        delaySeconds: null,
      };
    },
    start() {
      if (stopped && apiKey) {
        stopped = false;
        void tick();
      }
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
