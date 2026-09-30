import { createInterface } from "node:readline/promises";

import { createPostgresDb, migrate } from "./db";

// Applies pending migrations to the database in DATABASE_URL, after typing its host back —
// the same guard faceup-server uses, because a typo'd env var must not migrate the wrong base.
const url = process.env.DATABASE_URL ?? "";
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const host = new URL(url).hostname;
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`Migrate ${host}? Type the host to confirm: `);
rl.close();
if (answer.trim() !== host) {
  console.error("Host did not match — nothing applied.");
  process.exit(1);
}
const db = createPostgresDb(url);
const ran = await migrate(db, (m) => console.log(m));
console.log(ran.length ? `Done: ${ran.length} migration(s).` : "Already up to date.");
await db.close();
