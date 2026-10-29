import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Workspace, User } from "../src/app/domain/models";
export function createStore(
  path = process.env["DATABASE_PATH"] || "data/avenor.sqlite",
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,verified INTEGER NOT NULL,demo INTEGER NOT NULL,workspace TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,userId TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY,userId TEXT NOT NULL,kind TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS email_outbox (id TEXT PRIMARY KEY,userId TEXT NOT NULL,kind TEXT NOT NULL,tokenHash TEXT NOT NULL,email TEXT,url TEXT,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,nextAttempt INTEGER NOT NULL,expires INTEGER NOT NULL,leaseUntil INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS email_outbox_due ON email_outbox(status,nextAttempt);
    CREATE TABLE IF NOT EXISTS replays (userId TEXT NOT NULL,key TEXT NOT NULL,fingerprint TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(userId,key));`);
  return {
    db,
    getUser(id: string): User | null {
      const r = db
        .prepare("SELECT id,email,name,verified,demo FROM users WHERE id=?")
        .get(id) as any;
      return r ? { ...r, verified: !!r.verified, demo: !!r.demo } : null;
    },
    workspace(id: string): Workspace {
      const r = db
        .prepare("SELECT workspace FROM users WHERE id=?")
        .get(id) as { workspace: string };
      return JSON.parse(r.workspace);
    },
    save(id: string, w: Workspace) {
      db.prepare("UPDATE users SET workspace=? WHERE id=?").run(
        JSON.stringify(w),
        id,
      );
    },
    atomic<T>(fn: () => T): T {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
