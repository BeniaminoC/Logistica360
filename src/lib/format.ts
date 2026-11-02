const nf = new Intl.NumberFormat("es-CO");

export const num = (n: number | string | null | undefined) => nf.format(Number(n ?? 0));

export const cop = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n ?? 0));

/** Abrevia montos grandes: 12,4 M, 830 mil. */
export function copCorto(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000).toLocaleString("es-CO")} mil`;
  return `$${Math.round(v)}`;
}

const TZ = "America/Bogota";

export const fechaHora = (iso: string | Date | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("es-CO", { timeZone: TZ, day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })
    : "—";

export const hora = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) : "—";

/** "hace 5 min", "hace 2 h", "hace 3 d" */
export function hace(iso: string | Date | null | undefined, ahora = Date.now()) {
  if (!iso) return "sin datos";
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return "hace segundos";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export const ESTADO_PEDIDO: Record<string, string> = {
  pendiente: "Pendiente",
  asignado: "Asignado",
  en_ruta: "En ruta",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const TIPO_INCIDENTE: Record<string, string> = {
  accidente: "Accidente",
  falla_mecanica: "Falla mecánica",
  desvio: "Desvío de ruta",
  robo: "Robo o intento de robo",
  otro: "Otro",
};
