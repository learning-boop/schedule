import { readFileSync } from "fs";
import pg from "pg";

const sql = readFileSync("supabase/migrations/20261017_001_rls_and_triggers.sql", "utf-8");

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL,
});

await client.connect();
console.log("Connected. Running RLS migration...");

try {
  await client.query(sql);
  console.log("RLS migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
