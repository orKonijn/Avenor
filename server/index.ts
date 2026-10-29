import { createApp } from "./app";
import { validateRuntime } from "./config";
validateRuntime();
const { app, store, market, delivery } = createApp();
const port = Number(process.env["PORT"] || 3001);
const host = process.env["HOST"] || "127.0.0.1";
const server = app.listen(port, host, () => {
  console.log(`Avenor listening on port ${port}`);
  market.start();
  if (process.env["ENABLE_LOCAL_ACCOUNTS"] === "true") delivery.start();
});
const cleanup = setInterval(() => {
  store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  store.db.prepare("DELETE FROM tokens WHERE expires<?").run(Date.now());
}, 60_000);
cleanup.unref();
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(cleanup);
  market.stop();
  server.close(async () => {
    await delivery.stop();
    store.db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
