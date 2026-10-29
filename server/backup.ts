import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
const source = resolve(process.env["DATABASE_PATH"] || "data/avenor.sqlite");
const destination = resolve(
  process.argv[2] || `data/backups/avenor-${Date.now()}.sqlite`,
);
if (!existsSync(source)) throw new Error("Source database does not exist.");
if (source === destination || existsSync(destination))
  throw new Error("Choose a new backup destination.");
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  const check = new DatabaseSync(destination, { readOnly: true });
  try {
    if (
      (check.prepare("PRAGMA integrity_check").get() as any).integrity_check !==
      "ok"
    )
      throw new Error("Backup integrity check failed.");
  } finally {
    check.close();
  }
  console.log(
    "Consistent database backup completed. Store it securely off the service disk.",
  );
} finally {
  db.close();
}
