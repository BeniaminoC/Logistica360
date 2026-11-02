import { Pool, types, type QueryResultRow } from "pg";

// Tipos "amigables" para JSON: fechas en ISO, conteos y numéricos como número.
types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz
types.setTypeParser(20, (v) => parseInt(v, 10)); // bigint (count, sum de enteros)
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric

// Una sola conexión compartida por instancia serverless. En Vercel cada función puede
// reutilizar el pool entre invocaciones, por eso se guarda en globalThis.
const globalForPg = globalThis as unknown as { __pgPool?: Pool };

function crearPool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("Falta la variable de entorno DATABASE_URL (cadena de conexión de Aiven).");
  }
  const url = new URL(raw);
  url.searchParams.delete("sslmode"); // el modo TLS se define abajo, no en la URL
  const ca = process.env.DATABASE_CA_CERT?.trim();

  return new Pool({
    connectionString: url.toString(),
    // Aiven exige TLS. Con el certificado CA se verifica el servidor; sin él, solo se cifra.
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    // Pocas conexiones por instancia: el plan gratuito de Aiven tiene un límite bajo.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function pool(): Pool {
  if (!globalForPg.__pgPool) globalForPg.__pgPool = crearPool();
  return globalForPg.__pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Ejecuta varias consultas en una transacción. */
export async function transaccion<T>(fn: (q: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(async (text, params = []) => (await client.query(text, params)).rows as never);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
