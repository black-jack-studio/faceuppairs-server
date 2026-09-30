import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { createLocalDb, createPostgresDb, migrate, type Db } from "./db";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;
const production = process.env.NODE_ENV === "production";

let db: Db;
if (databaseUrl) {
  // Production (Supabase). Migrations are never applied on boot: run `npm run migrate`
  // deliberately, same rule as faceup-server.
  db = createPostgresDb(databaseUrl);
} else {
  if (production) throw new Error("DATABASE_URL is required in production — refusing to start on a local database.");
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".data");
  await mkdir(dataDir, { recursive: true });
  db = await createLocalDb(dataDir);
  await migrate(db, (m) => console.log(`[db] ${m}`));
  console.log(`[db] local Postgres (PGlite) in ${dataDir}`);
}

const app = createApp({ db, trustProxy: production });
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`FaceUp Pairs API on http://localhost:${info.port}`);
});
