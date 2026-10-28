import { createApp } from "./app";
if (
  process.env["ENABLE_LOCAL_ACCOUNTS"] === "true" &&
  (!process.env["EMAIL_WEBHOOK_URL"] || !process.env["APP_ORIGIN"])
)
  throw new Error("Local accounts require EMAIL_WEBHOOK_URL and APP_ORIGIN.");
const { app, store } = createApp();
const port = Number(process.env["PORT"] || 3001);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`Avenor API and production app: http://127.0.0.1:${port}`),
);
const cleanup = setInterval(() => {
  store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  store.db.prepare("DELETE FROM tokens WHERE expires<?").run(Date.now());
}, 60_000);
cleanup.unref();
process.on("SIGTERM", () =>
  server.close(() => {
    store.db.close();
    process.exit(0);
  }),
);
