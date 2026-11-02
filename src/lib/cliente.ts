/** Helper para llamadas POST desde componentes del navegador. */
export async function enviarJson<T = unknown>(
  url: string,
  cuerpo: unknown
): Promise<{ ok: true; datos: T } | { ok: false; error: string; red?: boolean }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo ?? {}) });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: (datos as { error?: string }).error ?? "No se pudo completar la acción." };
    return { ok: true, datos: datos as T };
  } catch {
    return { ok: false, error: "Sin conexión con el servidor.", red: true };
  }
}
