export function allowedEmails(env = process.env): string[] {
  return (env["PRIVATE_ACCOUNT_EMAILS"] || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
export function demoEnabled(env = process.env) {
  return env["ENABLE_DEMO"] !== "false" && env["NODE_ENV"] !== "production";
}
export function accountAllowed(email: string, env = process.env) {
  const emails = allowedEmails(env);
  return emails.length
    ? emails.includes(email.toLowerCase())
    : env["NODE_ENV"] !== "production";
}
export function validateRuntime(env = process.env) {
  if (!env["APP_ORIGIN"] && env["RENDER_EXTERNAL_URL"])
    env["APP_ORIGIN"] = env["RENDER_EXTERNAL_URL"];
  const production = env["NODE_ENV"] === "production";
  const accounts = env["ENABLE_LOCAL_ACCOUNTS"] === "true";
  if (production || accounts) {
    let origin: URL;
    try {
      origin = new URL(env["APP_ORIGIN"] || "");
    } catch {
      throw new Error("APP_ORIGIN must be a valid origin.");
    }
    if (
      origin.origin !== env["APP_ORIGIN"] ||
      (production && origin.protocol !== "https:") ||
      !["https:", "http:"].includes(origin.protocol)
    )
      throw new Error(
        "APP_ORIGIN must be an origin without path; production requires HTTPS.",
      );
  }
  if (
    accounts &&
    !((env["RESEND_API_KEY"] && env["EMAIL_FROM"]) || env["EMAIL_WEBHOOK_URL"])
  )
    throw new Error(
      "Accounts require RESEND_API_KEY and EMAIL_FROM, or an email webhook.",
    );
  if (production) {
    if (
      !accounts ||
      !allowedEmails(env).length ||
      allowedEmails(env).some((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    )
      throw new Error(
        "Private production requires accounts enabled and PRIVATE_ACCOUNT_EMAILS.",
      );
    if (!env["DATABASE_PATH"] || env["DATABASE_PATH"] === ":memory:")
      throw new Error(
        "Production requires DATABASE_PATH on persistent storage.",
      );
    if (!env["TWELVE_DATA_API_KEY"] || env["MARKET_DATA_USE"] !== "personal")
      throw new Error(
        "Private launch requires TWELVE_DATA_API_KEY and MARKET_DATA_USE=personal with appropriate display rights.",
      );
    if (
      env["EMAIL_WEBHOOK_URL"] &&
      !env["EMAIL_WEBHOOK_URL"].startsWith("https://")
    )
      throw new Error("Production email webhooks require HTTPS.");
  }
  const proxy = Number(env["TRUST_PROXY_HOPS"] || 0);
  if (!Number.isInteger(proxy) || proxy < 0 || proxy > 5)
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 5.");
}
