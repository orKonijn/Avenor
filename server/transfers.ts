import { randomUUID } from "node:crypto";
import { Workspace, Transaction } from "../src/app/domain/models";
import { decimal, DomainError, replay } from "../src/app/domain/ledger";

function accounts(
  w: Workspace,
  sourceId: string,
  destinationId: string,
  sourceRevision: unknown,
  destinationRevision: unknown,
) {
  const source = w.portfolios.find((p) => p.id === sourceId),
    destination = w.portfolios.find((p) => p.id === destinationId);
  if (!source || !destination)
    throw new DomainError("Portfolio not found.", "NOT_FOUND", 404);
  if (source.id === destination.id)
    throw new DomainError("Choose two different portfolios.");
  if (source.archived || destination.archived)
    throw new DomainError("Archived portfolios are read-only.");
  if (
    w.preferences.onboarding === 2 &&
    [source.id, destination.id].includes(w.onboarding?.portfolioId || "")
  )
    throw new DomainError(
      "Finish opening-balance setup before transferring cash.",
    );
  if (
    source.revision !== sourceRevision ||
    destination.revision !== destinationRevision
  )
    throw new DomainError(
      "One of these portfolios changed. Reload and review the transfer.",
      "CONFLICT",
      409,
    );
  return { source, destination };
}
export function recordTransfer(w: Workspace, body: any) {
  const { source, destination } = accounts(
    w,
    body.sourcePortfolioId,
    body.destinationPortfolioId,
    body.sourceRevision,
    body.destinationRevision,
  );
  const amount = decimal(body.amount, "Transfer amount", true).toString();
  if (!["USD", "EUR", "GBP"].includes(body.currency))
    throw new DomainError("Choose a supported cash currency.");
  if (
    typeof body.effectiveAt !== "string" ||
    !Number.isFinite(Date.parse(body.effectiveAt)) ||
    Date.parse(body.effectiveAt) > Date.now()
  )
    throw new DomainError(
      "Choose a valid transfer time that is not in the future.",
    );
  const transferId = randomUUID();
  const base = {
    transferId,
    effectiveAt: new Date(body.effectiveAt).toISOString(),
    quantity: "1",
    price: amount,
    fee: "0",
    currency: body.currency,
    note: String(body.note || "").slice(0, 500),
    revision: 1,
  };
  const records: Transaction[] = [
    { ...base, id: randomUUID(), portfolioId: source.id, type: "withdrawal" },
    { ...base, id: randomUUID(), portfolioId: destination.id, type: "deposit" },
  ];
  const candidate = [...w.transactions, ...records];
  for (const p of [source, destination])
    replay(candidate.filter((t) => t.portfolioId === p.id));
  w.transactions = candidate;
  for (const p of [source, destination]) p.revision++;
  for (const t of records)
    w.audit.push({
      id: randomUUID(),
      entityId: t.id,
      action: "cash transfer",
      at: new Date().toISOString(),
      before: null,
      after: t,
    });
  return { id: transferId };
}
export function voidTransfer(w: Workspace, id: string, body: any) {
  const pair = w.transactions.filter((t) => t.transferId === id);
  const debit = pair.find((t) => t.type === "withdrawal"),
    credit = pair.find((t) => t.type === "deposit");
  if (pair.length !== 2 || !debit || !credit)
    throw new DomainError("Transfer not found.", "NOT_FOUND", 404);
  if (pair.some((t) => t.voided))
    throw new DomainError("This transfer has already been voided.");
  const { source, destination } = accounts(
    w,
    debit.portfolioId,
    credit.portfolioId,
    body.sourceRevision,
    body.destinationRevision,
  );
  const candidate = w.transactions.map((t) =>
    t.transferId === id ? { ...t, voided: true, revision: t.revision + 1 } : t,
  );
  for (const p of [source, destination])
    replay(candidate.filter((t) => t.portfolioId === p.id));
  w.transactions = candidate;
  for (const p of [source, destination]) p.revision++;
  for (const t of pair)
    w.audit.push({
      id: randomUUID(),
      entityId: t.id,
      action: "cash transfer voided",
      at: new Date().toISOString(),
      before: t,
      after: candidate.find((c) => c.id === t.id)!,
    });
  return { id };
}
