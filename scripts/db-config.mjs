// Configuración de conexión compartida por los scripts (migrate / seed).
// Misma lógica que src/lib/db.ts: Aiven exige TLS.
import pg from "pg";

export function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y pega el Service URI de Aiven."
    );
    process.exit(1);
  }
  const url = new URL(raw);
  url.searchParams.delete("sslmode"); // pg interpreta sslmode distinto según versión; se controla abajo.
  const ca = process.env.DATABASE_CA_CERT?.trim();
  return new pg.Client({
    connectionString: url.toString(),
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  });
}
