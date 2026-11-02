import { NextResponse } from "next/server";
import { ErrorDeNegocio } from "./pedidos";

/** Ejecuta un handler y convierte errores de negocio en respuestas 4xx claras; el resto, en un 500 genérico. */
export async function manejar(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ErrorDeNegocio) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api]", err);
    const sinDb = err instanceof Error && /DATABASE_URL/.test(err.message);
    return NextResponse.json(
      { error: sinDb ? "La base de datos no está configurada (falta DATABASE_URL)." : "Ocurrió un error en el servidor. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}

export async function leerJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ErrorDeNegocio("El cuerpo de la solicitud no es JSON válido.");
  }
}

export const entero = (v: unknown, nombre: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ErrorDeNegocio(`${nombre} no es válido.`);
  return n;
};
