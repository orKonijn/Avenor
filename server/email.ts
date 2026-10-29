import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createStore } from "./store";

type Kind = "verify" | "reset";
type Config = {
  origin?: string;
  resendApiKey?: string;
  from?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  now?: () => number;
};
type Job = {
  id: string;
  userId: string;
  kind: Kind;
  tokenHash: string;
  email: string;
  url: string;
  attempts: number;
  expires: number;
};
const MAX_ATTEMPTS = 8;
const TOKEN_LIFETIME = 30 * 60_000;
const LEASE_TIME = 30_000;

/** The worker is deliberately opt-in: constructing an app never sends email. */
export function createEmailDelivery(
  store: ReturnType<typeof createStore>,
  config: Config = {},
  fetcher: typeof fetch = fetch,
) {
  const origin = config.origin ?? process.env["APP_ORIGIN"];
  const apiKey = config.resendApiKey ?? process.env["RESEND_API_KEY"];
  const from = config.from ?? process.env["EMAIL_FROM"];
  const webhook = config.webhookUrl ?? process.env["EMAIL_WEBHOOK_URL"];
  const webhookSecret =
    config.webhookSecret ?? process.env["EMAIL_WEBHOOK_SECRET"];
  const now = config.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;

  function enqueue(userId: string, kind: Kind, email: string) {
    if (!origin) throw new Error("Email delivery requires APP_ORIGIN.");
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const timestamp = now();
    const expires = timestamp + TOKEN_LIFETIME;
    const url = new URL(
      `/auth/${kind === "verify" ? "verify" : "reset"}`,
      origin,
    );
    url.searchParams.set("token", token);
    store.atomic(() => {
      store.db
        .prepare(
          "UPDATE email_outbox SET status='cancelled',email=NULL,url=NULL,leaseUntil=0 WHERE userId=? AND kind=? AND status='pending'",
        )
        .run(userId, kind);
      store.db
        .prepare("DELETE FROM tokens WHERE userId=? AND kind=?")
        .run(userId, kind);
      store.db
        .prepare("INSERT INTO tokens VALUES (?,?,?,?)")
        .run(tokenHash, userId, kind, expires);
      store.db
        .prepare(
          "INSERT INTO email_outbox (id,userId,kind,tokenHash,email,url,nextAttempt,expires) VALUES (?,?,?,?,?,?,?,?)",
        )
        .run(
          randomUUID(),
          userId,
          kind,
          tokenHash,
          email,
          url.toString(),
          timestamp,
          expires,
        );
    });
  }

  async function deliver(job: Job) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": `avenor-email-${job.id}`,
    };
    let endpoint: string;
    let body: object;
    if (apiKey && from) {
      endpoint = "https://api.resend.com/emails";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        from,
        to: [job.email],
        subject:
          job.kind === "verify"
            ? "Verify your Avenor email"
            : "Reset your Avenor password",
        text: `${job.kind === "verify" ? "Verify your email address" : "Reset your password"} using this link:\n\n${job.url}\n\nThis link expires 30 minutes after it was requested. If you did not request it, ignore this email.`,
      };
    } else if (webhook) {
      endpoint = webhook;
      headers["Authorization"] = `Bearer ${webhookSecret || ""}`;
      body = { email: job.email, kind: job.kind, url: job.url };
    } else {
      throw new Error("Email delivery is not configured.");
    }
    const response = await fetcher(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("Email provider rejected delivery.");
    // Never retain provider response bodies: they may contain personal data.
    await response.body?.cancel();
  }

  async function drain() {
    const timestamp = now();
    // Tokens may have been consumed, superseded, or expired while offline.
    store.db
      .prepare(
        "UPDATE email_outbox SET status='cancelled',email=NULL,url=NULL,leaseUntil=0 WHERE status='pending' AND (expires<=? OR NOT EXISTS (SELECT 1 FROM tokens WHERE hash=email_outbox.tokenHash))",
      )
      .run(timestamp);
    // A process may have crashed on its last attempt before recording failure.
    store.db
      .prepare(
        "UPDATE email_outbox SET status='failed',email=NULL,url=NULL,leaseUntil=0 WHERE status='pending' AND attempts>=? AND leaseUntil<=?",
      )
      .run(MAX_ATTEMPTS, timestamp);
    // Terminal rows have no deliverable payload and are retained only briefly.
    store.db
      .prepare("DELETE FROM email_outbox WHERE status!='pending' AND expires<?")
      .run(timestamp - 86_400_000);
    const jobs = store.db
      .prepare(
        "SELECT * FROM email_outbox WHERE status='pending' AND nextAttempt<=? AND leaseUntil<=? ORDER BY nextAttempt LIMIT 10",
      )
      .all(timestamp, timestamp) as unknown as Job[];
    for (const job of jobs) {
      const claimedAt = now();
      const claimed = store.db
        .prepare(
          "UPDATE email_outbox SET leaseUntil=?,attempts=attempts+1 WHERE id=? AND status='pending' AND leaseUntil<=? AND nextAttempt<=? AND expires>? AND attempts<? AND EXISTS (SELECT 1 FROM tokens WHERE hash=email_outbox.tokenHash) RETURNING *",
        )
        .get(
          claimedAt + LEASE_TIME,
          job.id,
          claimedAt,
          claimedAt,
          claimedAt,
          MAX_ATTEMPTS,
        ) as Job | undefined;
      if (!claimed) continue;
      try {
        await deliver(claimed);
        store.db
          .prepare(
            "UPDATE email_outbox SET status='sent',email=NULL,url=NULL,leaseUntil=0 WHERE id=? AND status='pending'",
          )
          .run(job.id);
      } catch {
        const attempts = claimed.attempts;
        if (attempts >= MAX_ATTEMPTS || now() >= job.expires) {
          store.db
            .prepare(
              "UPDATE email_outbox SET status='failed',email=NULL,url=NULL,leaseUntil=0 WHERE id=? AND status='pending'",
            )
            .run(job.id);
        } else {
          const delay = Math.min(60_000 * 2 ** (attempts - 1), 5 * 60_000);
          store.db
            .prepare(
              "UPDATE email_outbox SET nextAttempt=?,leaseUntil=0 WHERE id=? AND status='pending'",
            )
            .run(now() + delay, job.id);
        }
      }
    }
  }

  function processDue(): Promise<void> {
    if (!running)
      running = drain().finally(() => {
        running = undefined;
      });
    return running;
  }
  function start() {
    if (timer) return;
    const tick = () => {
      void processDue().catch(() =>
        console.error("Email queue processing failed."),
      );
    };
    timer = setInterval(tick, 10_000);
    timer.unref();
    tick();
  }
  async function stop() {
    if (timer) clearInterval(timer);
    timer = undefined;
    await running;
  }
  return { enqueue, processDue, start, stop };
}
