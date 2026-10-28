import { randomUUID } from "node:crypto";
import {
  Asset,
  OpeningDraft,
  Transaction,
  Workspace,
} from "../src/app/domain/models";
import { decimal, DomainError, replay } from "../src/app/domain/ledger";

export function normalizeOpeningDraft(body: unknown): OpeningDraft {
  const b = body as OpeningDraft;
  if (
    !b ||
    typeof b.date !== "string" ||
    b.date.length > 10 ||
    typeof b.cash !== "string" ||
    b.cash.length > 32 ||
    !Array.isArray(b.holdings) ||
    b.holdings.length > 500
  )
    throw new DomainError(
      "Provide a date, cash amount and up to 500 opening holdings.",
    );
  return {
    date: b.date,
    cash: b.cash,
    holdings: b.holdings.map((row) => {
      if (
        !row ||
        typeof row.assetId !== "string" ||
        row.assetId.length > 100 ||
        typeof row.quantity !== "string" ||
        row.quantity.length > 32 ||
        typeof row.price !== "string" ||
        row.price.length > 32 ||
        typeof row.basisUnknown !== "boolean" ||
        (row.acquiredAt !== null &&
          (typeof row.acquiredAt !== "string" || row.acquiredAt.length > 10))
      )
        throw new DomainError("Invalid opening holding draft.");
      return {
        assetId: row.assetId,
        quantity: row.quantity,
        price: row.price,
        basisUnknown: row.basisUnknown,
        acquiredAt: row.acquiredAt,
      };
    }),
  };
}
export function completeOnboarding(
  w: Workspace,
  draft: OpeningDraft,
  assets: Asset[],
) {
  const p = w.portfolios.find(
    (p) => p.id === w.onboarding?.portfolioId && !p.archived,
  );
  if (!p || w.preferences.onboarding !== 2)
    throw new DomainError(
      "Complete preferences and create your onboarding portfolio first.",
    );
  if (w.transactions.some((t) => t.portfolioId === p.id))
    throw new DomainError(
      "This portfolio already has activity. Finish setup through its recorded transactions.",
    );
  const date = new Date(draft.date + "T00:00:00.000Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(+date) ||
    date.toISOString().slice(0, 10) !== draft.date ||
    +date > Date.now()
  )
    throw new DomainError(
      "Choose a valid opening date that is not in the future.",
    );
  const cash = decimal(draft.cash, "Opening cash");
  const records: Transaction[] = [];
  const base = {
    portfolioId: p.id,
    effectiveAt: date.toISOString(),
    fee: "0",
    note: "Opening balance recorded during onboarding",
    revision: 1,
  };
  if (cash.gt(0))
    records.push({
      ...base,
      id: randomUUID(),
      type: "deposit",
      quantity: "1",
      price: cash.toString(),
      currency: p.currency,
    });
  const ids = new Set<string>();
  for (const row of draft.holdings) {
    const asset = assets.find((a) => a.id === row.assetId);
    if (!asset)
      throw new DomainError(
        "Choose an available asset for every opening holding.",
      );
    if (ids.has(asset.id))
      throw new DomainError(
        "Combine duplicate opening listings into one holding.",
      );
    ids.add(asset.id);
    if (row.acquiredAt) {
      const acquired = new Date(row.acquiredAt + "T00:00:00.000Z");
      if (
        !Number.isFinite(+acquired) ||
        acquired.toISOString().slice(0, 10) !== row.acquiredAt ||
        +acquired > +date
      )
        throw new DomainError(
          "Acquisition date must be valid and no later than the opening date.",
        );
    }
    records.push({
      ...base,
      id: randomUUID(),
      type: "opening",
      assetId: asset.id,
      currency: asset.currency,
      quantity: row.quantity,
      price: row.basisUnknown ? "0" : row.price,
      basisUnknown: row.basisUnknown,
      acquiredAt: row.acquiredAt
        ? new Date(row.acquiredAt + "T00:00:00.000Z").toISOString()
        : null,
    });
  }
  replay(records);
  w.transactions.push(...records);
  p.revision++;
  for (const record of records)
    w.audit.push({
      id: randomUUID(),
      entityId: record.id,
      action: "opening balance",
      at: new Date().toISOString(),
      before: null,
      after: record,
    });
  w.preferences.onboarding = 3;
  w.preferences.revision++;
  w.onboarding = { portfolioId: p.id };
  return p;
}
