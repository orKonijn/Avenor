import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { resolve } from "node:path";
import { createStore } from "./store";
import { assets, themes, newWorkspace, AS_OF } from "./sample";
import { completeOnboarding, normalizeOpeningDraft } from "./onboarding";
import { ledgerHistory } from "../src/app/domain/history";
import { sampleCloses } from "./history";
import { INTERESTS } from "../src/app/domain/preferences";
import { recordTransfer, voidTransfer } from "./transfers";
import {
  D,
  decimal,
  DomainError,
  replay,
  valueLedger,
  aggregateValuations,
} from "../src/app/domain/ledger";
import { Transaction, Workspace, AlertRule } from "../src/app/domain/models";
import {
  evaluateAlerts,
  evaluatePortfolioAlerts,
  evaluateRule,
} from "./alerts";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const passwordHash = (p: string) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
};
const verifyPassword = (p: string, stored: string) => {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(key, "hex"));
};
const dummyPassword = passwordHash(randomUUID());
const name = (n: unknown) => {
  if (typeof n !== "string" || !n.trim() || n.trim().length > 60)
    throw new DomainError("Name must contain 1–60 characters.");
  return n.trim();
};
const secret = () => randomBytes(32).toString("hex");
export function createApp(store = createStore()) {
  const app = express();
  const production = process.env["NODE_ENV"] === "production";
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:"],
          "connect-src": ["'self'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(
    "/v1",
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use((req, res, next) => {
    res.locals["requestId"] = randomUUID();
    res.set("Cache-Control", "no-store");
    next();
  });
  const send = (res: Response, data: unknown) =>
    res.json({
      data,
      meta: {
        requestId: res.locals["requestId"],
        asOf: AS_OF,
        source: "Avenor synthetic fixture",
        dataStatus: "sample",
        delaySeconds: null,
      },
    });
  const auth = (req: Request, res: Response, next: NextFunction) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("avenor_session="))
      ?.split("=")[1];
    const session = cookie
      ? (store.db
          .prepare("SELECT * FROM sessions WHERE id=? AND expires>?")
          .get(hash(cookie), Date.now()) as any)
      : null;
    if (!session)
      return next(
        new DomainError(
          "Your session has expired. Please sign in.",
          "UNAUTHENTICATED",
          401,
        ),
      );
    res.locals["session"] = session;
    res.locals["user"] = store.getUser(session.userId);
    if (req.method !== "GET" && req.headers["x-csrf-token"] !== session.csrf)
      return next(
        new DomainError("Reload the page and try again.", "FORBIDDEN", 403),
      );
    next();
  };
  const session = (res: Response, userId: string) => {
    const token = secret(),
      csrf = secret();
    store.db
      .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
      .run(hash(token), userId, csrf, Date.now() + 7 * 86_400_000);
    res.cookie("avenor_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: production,
      maxAge: 7 * 86_400_000,
      path: "/",
    });
    return csrf;
  };
  const valuations = (w: Workspace) => {
    const result = Object.fromEntries(
      w.portfolios
        .filter((p) => !p.archived)
        .map((p) => [
          p.id,
          valueLedger(
            w.transactions.filter((t) => t.portfolioId === p.id),
            assets,
            p.revision,
            w.preferences.currency,
          ),
        ]),
    );
    return { ...result, all: aggregateValuations(Object.values(result)) };
  };
  const bootstrap = (res: Response, id: string, csrf: string) => {
    const workspace = store.workspace(id);
    return send(res, {
      user: store.getUser(id),
      csrf,
      workspace,
      valuations: valuations(workspace),
      assets,
      themes,
      currencies: ["USD", "EUR", "GBP"],
    });
  };
  app.use(
    "/v1/auth",
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  // Reject cross-site browser writes, including the unauthenticated login boundary.
  app.use("/v1", (req, res, next) => {
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}` &&
      req.headers.origin !== process.env["APP_ORIGIN"]
    )
      return next(
        new DomainError("Cross-origin write rejected.", "FORBIDDEN", 403),
      );
    next();
  });
  app.post("/v1/auth/demo", (req, res) => {
    const id = randomUUID();
    store.db
      .prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)")
      .run(
        id,
        `${id}@sample.invalid`,
        "Alex Morgan",
        "",
        1,
        1,
        JSON.stringify(newWorkspace(req.body?.empty !== true)),
      );
    bootstrap(res, id, session(res, id));
  });
  app.post("/v1/auth/register", (req, res) => {
    if (process.env["ENABLE_LOCAL_ACCOUNTS"] !== "true")
      throw new DomainError(
        "Account registration is unavailable until email delivery and identity policy are configured. Explore the isolated demo.",
        "UNAVAILABLE",
        503,
      );
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase(),
      password = String(req.body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new DomainError("Enter a valid email address.");
    if (
      password.length < 12 ||
      password.length > 128 ||
      req.body.terms !== true
    )
      throw new DomainError(
        "Accept the terms and use a password of 12–128 characters.",
      );
    if (!store.db.prepare("SELECT id FROM users WHERE email=?").get(email)) {
      const id = randomUUID();
      store.db
        .prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)")
        .run(
          id,
          email,
          name(req.body.name),
          passwordHash(password),
          0,
          0,
          JSON.stringify(newWorkspace()),
        );
      queueEmail(id, "verify", email);
    }
    send(res, {
      message:
        "If this address can be registered, a verification email will arrive shortly.",
    });
  });
  function queueEmail(userId: string, kind: string, email: string) {
    const token = secret();
    store.db
      .prepare("DELETE FROM tokens WHERE userId=? AND kind=?")
      .run(userId, kind);
    store.db
      .prepare("INSERT INTO tokens VALUES (?,?,?,?)")
      .run(hash(token), userId, kind, Date.now() + 30 * 60_000);
    // Delivery is an explicit server adapter. Never return reset tokens through the public API.
    if (process.env["EMAIL_WEBHOOK_URL"])
      void fetch(process.env["EMAIL_WEBHOOK_URL"], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env["EMAIL_WEBHOOK_SECRET"] || ""}`,
        },
        body: JSON.stringify({
          email,
          kind,
          url: `${process.env["APP_ORIGIN"]}/auth/${kind === "verify" ? "verify" : "reset"}?token=${token}`,
        }),
      }).catch(() => console.error("Email adapter delivery failed"));
  }
  app.post("/v1/auth/login", (req, res) => {
    const row = store.db
      .prepare("SELECT * FROM users WHERE email=? AND demo=0")
      .get(
        String(req.body.email || "")
          .trim()
          .toLowerCase(),
      ) as any;
    const valid = verifyPassword(
      String(req.body.password || "").slice(0, 128),
      row?.password || dummyPassword,
    );
    if (!row || !valid)
      throw new DomainError(
        "Email or password is incorrect.",
        "UNAUTHENTICATED",
        401,
      );
    bootstrap(res, row.id, session(res, row.id));
  });
  app.post("/v1/auth/recover", (req, res) => {
    const row = store.db
      .prepare("SELECT id,email FROM users WHERE email=? AND demo=0")
      .get(
        String(req.body.email || "")
          .trim()
          .toLowerCase(),
      ) as any;
    if (row) {
      const recent = store.db
        .prepare("SELECT expires FROM tokens WHERE userId=? AND kind=?")
        .get(row.id, "reset") as any;
      if (!recent || recent.expires < Date.now() + 29 * 60_000)
        queueEmail(row.id, "reset", row.email);
    }
    send(res, {
      message:
        "If an account exists, a recovery link will arrive shortly. Check your inbox.",
    });
  });
  app.post("/v1/auth/reset", (req, res) => {
    const token = store.db
      .prepare("SELECT * FROM tokens WHERE hash=? AND kind=? AND expires>?")
      .get(hash(String(req.body.token)), "reset", Date.now()) as any;
    const password = String(req.body.password || "");
    if (!token)
      throw new DomainError(
        "This link is expired or has already been used. Request a new link.",
      );
    if (password.length < 12 || password.length > 128)
      throw new DomainError("Use a password of 12–128 characters.");
    store.atomic(() => {
      store.db
        .prepare("UPDATE users SET password=? WHERE id=?")
        .run(passwordHash(password), token.userId);
      store.db
        .prepare("DELETE FROM tokens WHERE userId=? AND kind=?")
        .run(token.userId, "reset");
      store.db.prepare("DELETE FROM sessions WHERE userId=?").run(token.userId);
    });
    send(res, { message: "Password updated. Sign in with your new password." });
  });
  app.post("/v1/auth/verify", (req, res) => {
    const token = store.db
      .prepare("SELECT * FROM tokens WHERE hash=? AND kind=? AND expires>?")
      .get(hash(String(req.body.token)), "verify", Date.now()) as any;
    if (!token)
      throw new DomainError(
        "This verification link is expired or has already been used.",
      );
    store.atomic(() => {
      store.db
        .prepare("UPDATE users SET verified=1 WHERE id=?")
        .run(token.userId);
      store.db
        .prepare("DELETE FROM tokens WHERE hash=?")
        .run(hash(String(req.body.token)));
    });
    send(res, { message: "Email verified. You can now sign in." });
  });
  app.post("/v1/auth/resend-verification", (req, res) => {
    const row = store.db
      .prepare(
        "SELECT id,email FROM users WHERE email=? AND demo=0 AND verified=0",
      )
      .get(
        String(req.body.email || "")
          .trim()
          .toLowerCase(),
      ) as any;
    if (row) {
      const recent = store.db
        .prepare("SELECT expires FROM tokens WHERE userId=? AND kind=?")
        .get(row.id, "verify") as any;
      if (!recent || recent.expires < Date.now() + 29 * 60_000)
        queueEmail(row.id, "verify", row.email);
    }
    send(res, {
      message:
        "If this account needs verification, a new link will arrive shortly.",
    });
  });
  app.get("/v1/session", auth, (_req, res) =>
    bootstrap(res, res.locals["user"].id, res.locals["session"].csrf),
  );
  app.post("/v1/logout", auth, (_req, res) => {
    store.db
      .prepare("DELETE FROM sessions WHERE id=?")
      .run(res.locals["session"].id);
    res.clearCookie("avenor_session", { path: "/" });
    send(res, { ok: true });
  });
  app.use("/v1", auth);
  function mutate(req: Request, res: Response, fn: (w: Workspace) => unknown) {
    const user = res.locals["user"];
    if (!user.verified)
      throw new DomainError(
        "Verify your email before changing portfolio data.",
        "FORBIDDEN",
        403,
      );
    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || key.length > 100)
      throw new DomainError("An idempotency key is required.");
    const fingerprint = hash(req.method + req.path + JSON.stringify(req.body));
    const data = store.atomic(() => {
      const old = store.db
        .prepare("SELECT * FROM replays WHERE userId=? AND key=?")
        .get(user.id, key) as any;
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new DomainError(
            "This request key has already been used for a different change.",
            "CONFLICT",
            409,
          );
        const original = JSON.parse(old.response);
        const current = store.workspace(user.id);
        return {
          ...original,
          workspace: current,
          valuations: valuations(current),
        };
      }
      const w = store.workspace(user.id),
        result = fn(w);
      w.revision = (w.revision || 0) + 1;
      store.save(user.id, w);
      const response = { result, workspace: w, valuations: valuations(w) };
      store.db
        .prepare("INSERT INTO replays VALUES (?,?,?,?)")
        .run(user.id, key, fingerprint, JSON.stringify(response));
      return response;
    });
    return send(res, data);
  }
  const portfolio = (w: Workspace, id: string) => {
    const p = w.portfolios.find((p) => p.id === id);
    if (!p) throw new DomainError("Portfolio not found.", "NOT_FOUND", 404);
    return p;
  };
  const audit = (
    w: Workspace,
    entityId: string,
    action: string,
    before: unknown,
    after: unknown,
  ) =>
    w.audit.push({
      id: randomUUID(),
      entityId,
      action,
      at: new Date().toISOString(),
      before,
      after,
    });
  app.get("/v1/portfolios", (_req, res) =>
    send(res, store.workspace(res.locals["user"].id).portfolios),
  );
  app.post("/v1/portfolios", (req, res) =>
    mutate(req, res, (w) => {
      const title = name(req.body.name);
      if (w.portfolios.filter((p) => !p.archived).length >= 20)
        throw new DomainError("You can have up to 20 portfolios.");
      if (
        w.portfolios.some((p) => p.name.toLowerCase() === title.toLowerCase())
      )
        throw new DomainError("A portfolio with this name already exists.");
      if (!["USD", "EUR", "GBP"].includes(req.body.currency))
        throw new DomainError("Unsupported currency.");
      const p = {
        id: randomUUID(),
        name: title,
        currency: req.body.currency,
        revision: 0,
        archived: false,
      };
      w.portfolios.push(p);
      if (req.body.onboarding === true) {
        if (w.preferences.onboarding !== 1 || w.onboarding?.portfolioId)
          throw new DomainError(
            "Resume your existing setup instead of creating another onboarding portfolio.",
            "CONFLICT",
            409,
          );
        w.onboarding = { portfolioId: p.id };
        w.preferences.onboarding = 2;
        w.preferences.revision++;
      }
      return p;
    }),
  );
  app.patch("/v1/portfolios/:id", (req, res) =>
    mutate(req, res, (w) => {
      const p = portfolio(w, String(req.params["id"]));
      if (p.revision !== req.body.revision)
        throw new DomainError(
          "This portfolio changed. Reload and review your changes.",
          "CONFLICT",
          409,
        );
      const before = { ...p };
      if (req.body.name) {
        const n = name(req.body.name);
        if (
          w.portfolios.some(
            (x) => x.id !== p.id && x.name.toLowerCase() === n.toLowerCase(),
          )
        )
          throw new DomainError("A portfolio with this name already exists.");
        p.name = n;
      }
      if (req.body.archived) {
        if (
          w.preferences.onboarding === 2 &&
          w.onboarding?.portfolioId === p.id
        )
          throw new DomainError(
            "Finish opening-balance setup before archiving this portfolio.",
          );
        const ledger = replay(
          w.transactions.filter((t) => t.portfolioId === p.id),
        );
        if (
          Object.values(ledger.cash).some((v) => !D(v).isZero()) ||
          ledger.positions.some((p) => !D(p.quantity).isZero())
        )
          throw new DomainError(
            "Close all positions and cash balances before archiving.",
          );
        p.archived = true;
      }
      p.revision++;
      audit(w, p.id, "portfolio updated", before, p);
      return p;
    }),
  );
  app.get("/v1/portfolios/:id/holdings", (req, res) => {
    const w = store.workspace(res.locals["user"].id),
      p = portfolio(w, String(req.params["id"]));
    send(
      res,
      valueLedger(
        w.transactions.filter((t) => t.portfolioId === p.id),
        assets,
        p.revision,
        String(req.query["currency"] || w.preferences.currency),
      ),
    );
  });
  app.get("/v1/history", (req, res) => {
    const w = store.workspace(res.locals["user"].id);
    const id = String(req.query["portfolioId"] || "all");
    if (id !== "all") portfolio(w, id);
    const currency = String(req.query["currency"] || w.preferences.currency);
    if (!["USD", "EUR", "GBP"].includes(currency))
      throw new DomainError("Choose a supported currency.");
    send(
      res,
      ledgerHistory(
        w.transactions.filter((t) => id === "all" || t.portfolioId === id),
        assets,
        res.locals["user"].demo ? sampleCloses : [],
        String(req.query["from"] || ""),
        String(req.query["to"] || ""),
        currency,
        w.revision,
      ),
    );
  });
  app.get("/v1/portfolios/:id/transactions", (req, res) => {
    const w = store.workspace(res.locals["user"].id),
      p = portfolio(w, String(req.params["id"]));
    send(
      res,
      w.transactions.filter((t) => t.portfolioId === p.id),
    );
  });
  function transactionChange(
    req: Request,
    res: Response,
    mode: "new" | "edit" | "void",
  ) {
    return mutate(req, res, (w) => {
      const old =
        mode === "new"
          ? null
          : w.transactions.find((t) => t.id === req.params["id"]);
      if (mode !== "new" && !old)
        throw new DomainError("Transaction not found.", "NOT_FOUND", 404);
      if (old?.transferId || req.body.transferId)
        throw new DomainError(
          "Use the linked transfer to change both cash legs together.",
        );
      const p = portfolio(w, old?.portfolioId || String(req.params["id"]));
      if (w.preferences.onboarding === 2 && w.onboarding?.portfolioId === p.id)
        throw new DomainError(
          "Finish opening-balance setup before recording or correcting transactions in this portfolio.",
        );
      if (p.archived)
        throw new DomainError("Archived portfolios are read-only.");
      if (req.body.revision !== p.revision)
        throw new DomainError(
          "The ledger changed. Reload and review your draft before saving.",
          "CONFLICT",
          409,
        );
      const before = old ? { ...old } : null;
      const t: Transaction =
        mode === "void"
          ? { ...old!, voided: true, revision: old!.revision + 1 }
          : {
              id: old?.id || randomUUID(),
              portfolioId: p.id,
              type: req.body.type,
              effectiveAt: req.body.effectiveAt,
              assetId: req.body.assetId,
              quantity: req.body.quantity,
              price: req.body.price,
              fee: req.body.fee,
              currency: req.body.currency,
              note: String(req.body.note || "").slice(0, 500),
              destinationCurrency: req.body.destinationCurrency,
              rate: req.body.rate,
              basisUnknown: req.body.basisUnknown === true,
              acquiredAt: req.body.acquiredAt ?? null,
              revision: (old?.revision || 0) + 1,
            };
      if (
        typeof t.effectiveAt !== "string" ||
        !Number.isFinite(Date.parse(t.effectiveAt))
      )
        throw new DomainError("Choose a valid transaction date.");
      if (
        t.acquiredAt !== null &&
        t.acquiredAt !== undefined &&
        (typeof t.acquiredAt !== "string" ||
          !Number.isFinite(Date.parse(t.acquiredAt)))
      )
        throw new DomainError(
          "Choose a valid acquisition date or leave it unknown.",
        );
      t.effectiveAt = new Date(t.effectiveAt).toISOString();
      if (["buy", "sell", "split", "dividend", "opening"].includes(t.type)) {
        const a = assets.find((a) => a.id === t.assetId);
        if (!a || a.currency !== t.currency)
          throw new DomainError("Choose an asset and its quote currency.");
      }
      const candidate = old
        ? w.transactions.map((x) => (x.id === old.id ? t : x))
        : [...w.transactions, t];
      replay(candidate.filter((x) => x.portfolioId === p.id));
      w.transactions = candidate;
      p.revision++;
      audit(w, t.id, mode, before, t);
      return t;
    });
  }
  app.post("/v1/portfolios/:id/transactions", (req, res) =>
    transactionChange(req, res, "new"),
  );
  app.post("/v1/transfers", (req, res) =>
    mutate(req, res, (w) => recordTransfer(w, req.body)),
  );
  app.post("/v1/transfers/:id/void", (req, res) =>
    mutate(req, res, (w) =>
      voidTransfer(w, String(req.params["id"]), req.body),
    ),
  );
  app.patch("/v1/transactions/:id", (req, res) =>
    transactionChange(req, res, "edit"),
  );
  app.post("/v1/transactions/:id/void", (req, res) =>
    transactionChange(req, res, "void"),
  );
  app.patch("/v1/me/preferences", (req, res) =>
    mutate(req, res, (w) => {
      if (req.body.revision !== w.preferences.revision)
        throw new DomainError(
          "Preferences changed. Reload and review.",
          "CONFLICT",
          409,
        );
      const p = req.body;
      if (
        !["light", "dark", "system"].includes(p.appearance) ||
        !["USD", "EUR", "GBP"].includes(p.currency)
      )
        throw new DomainError("Unsupported appearance or currency.");
      try {
        new Intl.DateTimeFormat(p.locale, { timeZone: p.timeZone }).format();
      } catch {
        throw new DomainError("Choose a valid locale and time zone.");
      }
      if (
        p.density !== undefined &&
        !["comfortable", "compact"].includes(p.density)
      )
        throw new DomainError("Choose comfortable or compact spacing.");
      if (
        p.interests !== undefined &&
        (!Array.isArray(p.interests) ||
          p.interests.length > INTERESTS.length ||
          p.interests.some(
            (x: unknown) =>
              typeof x !== "string" || !INTERESTS.includes(x as any),
          ))
      )
        throw new DomainError("Choose interests from the available options.");
      w.preferences = {
        ...w.preferences,
        appearance: p.appearance,
        currency: p.currency,
        locale: p.locale,
        timeZone: p.timeZone,
        density: p.density ?? w.preferences.density ?? "comfortable",
        interests:
          p.interests === undefined
            ? w.preferences.interests
            : [...new Set<string>(p.interests)],
        onboarding: Math.max(
          w.preferences.onboarding,
          Math.min(1, Math.max(0, Number(p.onboarding) || 0)),
        ),
        revision: w.preferences.revision + 1,
      };
      return w.preferences;
    }),
  );
  app.put("/v1/onboarding/holdings-draft", (req, res) =>
    mutate(req, res, (w) => {
      if (w.preferences.onboarding !== 2 || !w.onboarding?.portfolioId)
        throw new DomainError("Create your onboarding portfolio first.");
      if (req.body.revision !== w.revision)
        throw new DomainError(
          "Your setup changed in another session. Reload before saving this draft.",
          "CONFLICT",
          409,
        );
      w.onboarding.draft = normalizeOpeningDraft(req.body.draft);
      return w.onboarding;
    }),
  );
  app.post("/v1/onboarding/complete", (req, res) =>
    mutate(req, res, (w) => {
      if (req.body.revision !== w.revision)
        throw new DomainError(
          "Your setup changed. Reload and review your opening balances.",
          "CONFLICT",
          409,
        );
      return completeOnboarding(
        w,
        normalizeOpeningDraft(req.body.draft),
        assets,
      );
    }),
  );
  app.get("/v1/assets", (req, res) =>
    send(
      res,
      assets.filter((a) =>
        (a.name + a.symbol + a.exchange)
          .toLowerCase()
          .includes(String(req.query["query"] || "").toLowerCase()),
      ),
    ),
  );
  app.get("/v1/assets/:id", (req, res) => {
    const a = assets.find((a) => a.id === req.params["id"]);
    if (!a) throw new DomainError("Asset not found.", "NOT_FOUND", 404);
    send(res, a);
  });
  app.get("/v1/themes", (_req, res) => send(res, themes));
  app.post("/v1/themes/:id/follow", (req, res) =>
    mutate(req, res, (w) => {
      const id = String(req.params["id"]);
      if (!themes.some((t) => t.id === id))
        throw new DomainError("Theme not found.", "NOT_FOUND", 404);
      w.followedThemes = w.followedThemes.includes(id)
        ? w.followedThemes.filter((x) => x !== id)
        : [...w.followedThemes, id];
      return w.followedThemes;
    }),
  );
  app.post("/v1/watchlists", (req, res) =>
    mutate(req, res, (w) => {
      const title = name(req.body.name);
      if (w.watchlists.length >= 20)
        throw new DomainError("You can have up to 20 watchlists.");
      if (
        w.watchlists.some((x) => x.name.toLowerCase() === title.toLowerCase())
      )
        throw new DomainError("A watchlist with this name already exists.");
      const item = { id: randomUUID(), name: title, items: [], revision: 0 };
      w.watchlists.push(item);
      return item;
    }),
  );
  app.patch("/v1/watchlists/:id", (req, res) =>
    mutate(req, res, (w) => {
      const item = w.watchlists.find((x) => x.id === req.params["id"]);
      if (!item)
        throw new DomainError("Watchlist not found.", "NOT_FOUND", 404);
      if (req.body.revision !== (item.revision ?? 0))
        throw new DomainError(
          "This watchlist changed in another tab. Reload the latest list before trying again.",
          "CONFLICT",
          409,
        );
      if (req.body.name !== undefined) {
        const n = name(req.body.name);
        if (
          w.watchlists.some(
            (x) => x.id !== item.id && x.name.toLowerCase() === n.toLowerCase(),
          )
        )
          throw new DomainError("This name already exists.");
        item.name = n;
      }
      if (req.body.items) {
        if (
          !Array.isArray(req.body.items) ||
          req.body.items.length > 500 ||
          req.body.items.some(
            (id: string) =>
              !assets.some((a) => a.id === id) &&
              !themes.some((t) => t.id === id),
          )
        )
          throw new DomainError("Choose valid assets or themes.");
        item.items = [...new Set<string>(req.body.items)];
      }
      item.revision = (item.revision ?? 0) + 1;
      return item;
    }),
  );
  app.delete("/v1/watchlists/:id", (req, res) =>
    mutate(req, res, (w) => {
      const item = w.watchlists.find((x) => x.id === req.params["id"]);
      if (!item)
        throw new DomainError("Watchlist not found.", "NOT_FOUND", 404);
      if (req.body.revision !== (item.revision ?? 0))
        throw new DomainError(
          "This watchlist changed in another tab. Reload the latest list before trying again.",
          "CONFLICT",
          409,
        );
      w.watchlists = w.watchlists.filter((x) => x.id !== item.id);
      return { ok: true };
    }),
  );
  app.post("/v1/alerts", (req, res) =>
    mutate(req, res, (w) => {
      if (w.alerts.length >= 100)
        throw new DomainError("You can have up to 100 alerts.");
      const kind = req.body.kind || "price";
      if (!["price", "portfolio-value", "portfolio-drawdown"].includes(kind))
        throw new DomainError("Choose a supported alert type.");
      const a =
        kind === "price" ? assets.find((a) => a.id === req.body.assetId) : null;
      const p =
        kind === "price" ? null : portfolio(w, String(req.body.portfolioId));
      if (kind === "price" && !a)
        throw new DomainError("Choose a valid asset.");
      if (p?.archived) throw new DomainError("Choose an active portfolio.");
      decimal(req.body.threshold, "Threshold", true);
      if (kind === "portfolio-drawdown" && D(req.body.threshold).gt(100))
        throw new DomainError("Daily-loss threshold cannot exceed 100%.");
      if (
        !["above", "below"].includes(req.body.direction) ||
        !["once", "recurring"].includes(req.body.cadence)
      )
        throw new DomainError("Choose a valid condition and cadence.");
      const currency = a?.currency || req.body.currency;
      if (!["USD", "EUR", "GBP"].includes(currency))
        throw new DomainError("Choose a supported fixed alert currency.");
      const initial =
        a?.price ??
        (p
          ? valueLedger(
              w.transactions.filter((t) => t.portfolioId === p.id),
              assets,
              p.revision,
              currency,
            ).value
          : null);
      const alert: AlertRule = {
        id: randomUUID(),
        kind,
        assetId: a?.id || "",
        portfolioId: p?.id,
        currency,
        basis:
          kind === "price"
            ? "quote-price"
            : kind === "portfolio-value"
              ? "portfolio-value"
              : "close-to-close-net-flow",
        direction: kind === "portfolio-drawdown" ? "above" : req.body.direction,
        threshold: req.body.threshold,
        cadence: req.body.cadence,
        paused: false,
        previous: kind === "portfolio-drawdown" ? null : initial,
        previousClose: null,
        lastFired: null,
        state:
          kind === "portfolio-drawdown"
            ? "Collecting comparable closes"
            : "Sample feed · waiting for a new observation",
      };
      w.alerts.push(alert);
      if (
        req.body.notifyNow === true &&
        initial !== null &&
        kind !== "portfolio-drawdown"
      )
        evaluateRule(
          w,
          alert,
          initial,
          new Date().toISOString(),
          new Date(),
          true,
        );
      return alert;
    }),
  );
  app.patch("/v1/alerts/:id", (req, res) =>
    mutate(req, res, (w) => {
      const a = w.alerts.find((x) => x.id === req.params["id"]);
      if (!a) throw new DomainError("Alert not found.", "NOT_FOUND", 404);
      if (typeof req.body.paused === "boolean") a.paused = req.body.paused;
      if (req.body.threshold) {
        decimal(req.body.threshold, "Threshold", true);
        if (a.kind === "portfolio-drawdown" && D(req.body.threshold).gt(100))
          throw new DomainError("Daily-loss threshold cannot exceed 100%.");
        a.threshold = req.body.threshold;
        a.version = (a.version || 1) + 1;
        a.previous = null;
        a.previousClose = null;
        a.lastObservedAt = null;
        a.state = "Rule updated · waiting for a fresh baseline";
      }
      return a;
    }),
  );
  app.delete("/v1/alerts/:id", (req, res) =>
    mutate(req, res, (w) => {
      w.alerts = w.alerts.filter((x) => x.id !== req.params["id"]);
      return { ok: true };
    }),
  );
  app.post("/v1/notifications/mark-read", (req, res) =>
    mutate(req, res, (w) => {
      w.notifications.forEach((n) => {
        if (!req.body.id || n.id === req.body.id)
          n.readAt = new Date().toISOString();
      });
      return { ok: true };
    }),
  );
  app.post("/v1/demo/observations", (req, res) =>
    mutate(req, res, (w) => {
      if (!res.locals["user"].demo)
        throw new DomainError(
          "Only available in the sample workspace.",
          "FORBIDDEN",
          403,
        );
      decimal(req.body.value, "Observation", true);
      evaluateAlerts(
        w,
        req.body.assetId,
        req.body.value,
        new Date().toISOString(),
        true,
      );
      return { ok: true };
    }),
  );
  app.post("/v1/demo/portfolio-observations", (req, res) =>
    mutate(req, res, (w) => {
      if (!res.locals["user"].demo)
        throw new DomainError(
          "Only available in the sample workspace.",
          "FORBIDDEN",
          403,
        );
      const p = portfolio(w, String(req.body.portfolioId));
      if (p.archived) throw new DomainError("Choose an active portfolio.");
      if (!["USD", "EUR", "GBP"].includes(req.body.currency))
        throw new DomainError("Choose a supported observation currency.");
      const at = String(req.body.observedAt || new Date().toISOString());
      if (!Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now())
        throw new DomainError(
          "Choose a valid observation time that is not in the future.",
        );
      evaluatePortfolioAlerts(
        w,
        p.id,
        req.body.value,
        req.body.currency,
        new Date(at).toISOString(),
        req.body.externalFlow || "0",
        req.body.fresh !== false,
      );
      return { ok: true };
    }),
  );
  app.use("/v1", (_req, _res, next) =>
    next(new DomainError("This endpoint is unavailable.", "NOT_FOUND", 404)),
  );
  app.use(
    express.static(resolve("dist/avenor/browser"), {
      setHeaders: (res) => res.set("Cache-Control", "public, max-age=3600"),
    }),
  );
  app.get("/{*path}", (_req, res) =>
    res.sendFile(resolve("dist/avenor/browser/index.html")),
  );
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      err instanceof DomainError
        ? err.status
        : err.type === "entity.parse.failed"
          ? 400
          : 500;
    res.status(status).json({
      code: err.code || "INTERNAL",
      message:
        status === 500
          ? "Something went wrong. Your changes were not saved."
          : err.message,
      fieldErrors: {},
      requestId: res.locals["requestId"],
    });
  });
  return { app, store };
}
