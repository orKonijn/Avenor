# Private personal launch

This deployment is for one owner's personal use. It is not an open public service. Production disables sample sessions and requires an email allowlist, HTTPS origin, persistent database, email adapter, and market-data credentials. Do not broaden access without reviewing identity, data licensing, operational security, and retention requirements.

## Services and secrets

Use a paid Render Node web service with a persistent disk. The repository includes render.yaml; alternatively use the same values in Render's Web Service form. Build: npm ci --include=dev && npm run build. Start: npm start. Node: 24.19.0. Host: 0.0.0.0. Health path: /healthz. Database: /var/data/avenor.sqlite on a disk mounted at /var/data. One instance only; disk deployments have brief downtime. Keep automatic deploys off until checks and CR pass.

Enter PRIVATE_ACCOUNT_EMAILS with the owner's email in Render, not in tracked files. Set ENABLE_LOCAL_ACCOUNTS=true, ENABLE_DEMO=false, NODE_ENV=production and TRUST_PROXY_HOPS=1. The app uses RENDER_EXTERNAL_URL as APP_ORIGIN unless explicitly set. A custom domain requires updating APP_ORIGIN to the exact HTTPS origin.

Create a Resend sending key and set RESEND_API_KEY and EMAIL_FROM. Verify a sending domain for normal delivery. For an owner-only pilot, Resend's test sender onboarding@resend.dev can email only the email address owning the Resend account. Do not use this sender for other users. No credentials belong in browser bundles or Git.

Set TWELVE_DATA_API_KEY and MARKET_DATA_USE=personal only after confirming your plan permits this personal display use. Free API access is not proof of display rights. Twelve Data's individual pricing separates internal non-display from internal display access. Provider/exchange terms and fees apply. This repository does not buy a plan or grant a license.

## What is live-capable

Real accounts begin with empty owned ledgers, email verification, and single-use password recovery. Verification/reset mail is queued durably with bounded retries, a stable delivery idempotency key, expiry and payload cleanup. Only the allowlisted address can register or log in; the same check applies to existing sessions. The public auth configuration exposes flags, never the allowlist or credentials.

Twelve Data quotes are fetched only by the server for the existing six-instrument catalog. Requests are spaced ten seconds apart, with fifteen minutes between cycles. The first full cycle takes about a minute. The browser sees the latest cache when loading or reloading data. Instrument, MIC, currency, decimal prices and actual quote timestamp must match. Failed, missing, out-of-order, or older-than-24-hour quotes become unavailable; no sample fallback is used. Weekend/holiday gaps may therefore be unavailable. Do not interpret a provider quote as a guaranteed real-time executable price.

History, FX conversion, news, theme evidence, benchmarks and continuous alert evaluation are not connected. Real accounts do not receive sample themes, charts or synthetic risk metrics. Alert Notify now can evaluate an available cached quote; the sample observation controls are not available to real accounts.

## Deploy and verify

1. Merge the reviewed, passing change into main.
2. Configure the service and secret environment variables in Render, review the displayed price, and deploy main.
3. Verify /healthz returns 200 through HTTPS. Confirm the login screen offers no sample workspace and indicates private access.
4. Register the approved email, receive and use verification, sign in, complete setup, and refresh. Confirm records survive a service restart.
5. Verify quote timestamps and values against your provider dashboard. Confirm failures show unavailable values and API keys are absent from network responses.
6. Test recovery with the owner's inbox. A reset must invalidate old sessions. Delivery checks with mock services do not establish live deliverability.

## Backup and restore

Use the online SQLite backup API, not a copy of a running WAL database:

    DATABASE_PATH=/var/data/avenor.sqlite npx tsx server/backup.ts /var/data/backups/avenor-YYYYMMDD.sqlite

The command refuses existing destinations and checks backup integrity. Download a backup through Render's authenticated operator access and retain an encrypted copy outside the service disk. The backup contains sensitive account/portfolio data and must never be published. Render disk snapshots alone are not a verified restore process.

Restore only with the service stopped and after preserving the current database. Place the validated backup at DATABASE_PATH, remove stale WAL/SHM files for that stopped database, restart, and verify account and ledger state. Test restoration before relying on this for valuable data. Account export/deletion UI, managed identity and operational monitoring remain future work.

## References checked 29 October 2026

- https://render.com/docs/disks
- https://render.com/docs/blueprint-spec
- https://resend.com/docs/api-reference/errors
- https://twelvedata.com/docs
- https://twelvedata.com/pricing
- https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage
