"use client";

import { enviarJson } from "./cliente";

/**
 * Cola de envíos pendientes para zonas sin cobertura: si no hay red, la acción del conductor se guarda en el
 * dispositivo y se reenvía sola cuando vuelve la conexión (requisito de tolerancia a la conectividad).
 * Solo se encolan fallos de red; un rechazo del servidor (datos inválidos) se informa al instante.
 */
type Envio = { url: string; cuerpo: unknown; creado: number };
const CLAVE = "l360_envios_pendientes";

function leer(): Envio[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? "[]"); } catch { return []; }
}
function guardar(cola: Envio[]) {
  try { localStorage.setItem(CLAVE, JSON.stringify(cola.slice(-200))); } catch { /* almacenamiento lleno o bloqueado */ }
}

export const pendientes = () => leer().length;

export async function enviarConCola(url: string, cuerpo: unknown): Promise<{ ok: true; encolado: boolean } | { ok: false; error: string }> {
  const r = await enviarJson(url, cuerpo);
  if (r.ok) return { ok: true, encolado: false };
  if (r.red) {
    guardar([...leer(), { url, cuerpo, creado: Date.now() }]);
    return { ok: true, encolado: true };
  }
  return { ok: false, error: r.error };
}

/** Reenvía en orden; se detiene en el primer fallo de red. Devuelve cuántos quedan. */
export async function vaciarCola(): Promise<number> {
  let cola = leer();
  while (cola.length) {
    const [primero, ...resto] = cola;
    const r = await enviarJson(primero.url, primero.cuerpo);
    if (!r.ok && r.red) break;
    cola = resto; // enviado, o rechazado por el servidor (ya no tiene sentido reintentarlo)
    guardar(cola);
  }
  return cola.length;
}
