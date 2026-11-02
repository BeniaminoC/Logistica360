import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "./db-config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");

const client = createClient();
await client.connect();
try {
  await client.query(sql);
  console.log("✔ Esquema aplicado correctamente.");
} catch (err) {
  console.error("✘ Error aplicando el esquema:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
