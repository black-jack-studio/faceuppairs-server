import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

// The same SQL runs on two engines: PGlite (real Postgres compiled to WASM, in-process) for
// local development and tests — nothing to install — and Supabase Postgres in production.
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  close(): Promise<void>;
}

export async function createLocalDb(dataDir?: string): Promise<Db> {
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const result = await pg.query<T>(text, params as never[]);
      return result.rows;
    },
    async exec(text) {
      await pg.exec(text);
    },
    async close() {
      await pg.close();
    },
  };
}

export function createPostgresDb(url: string): Db {
  // Supabase's pooler caps connections per project; stay well under it (same reasoning as
  // faceup-server/server/db.ts, which hit EMAXCONNSESSION with a larger pool).
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 30, connect_timeout: 10 });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[];
    },
    async exec(text) {
      await sql.unsafe(text);
    },
    async close() {
      await sql.end();
    },
  };
}

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Applies every migrations/*.sql not yet recorded, in name order. */
export async function migrate(db: Db, log: (msg: string) => void = () => {}): Promise<string[]> {
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set((await db.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.exec(await readFile(join(MIGRATIONS_DIR, file), "utf8"));
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
    log(`applied ${file}`);
    ran.push(file);
  }
  return ran;
}
