import type { Situacion } from "./types";

/** Cómo se dibuja y se nombra cada situación de un vehículo (mapa, leyenda, tablas). */
export const SITUACIONES: Record<Situacion, { etiqueta: string; relleno: string; borde: string; discontinuo?: boolean }> = {
  en_ruta: { etiqueta: "En ruta", relleno: "#1f6fb5", borde: "#1f6fb5" },
  retrasado: { etiqueta: "Con retraso", relleno: "#c4372a", borde: "#c4372a" },
  sin_senal: { etiqueta: "Sin señal", relleno: "#ffffff", borde: "#c4372a", discontinuo: true },
  asignado: { etiqueta: "Por salir", relleno: "#ffffff", borde: "#1f6fb5" },
  disponible: { etiqueta: "Disponible", relleno: "#2a9a67", borde: "#2a9a67" },
  mantenimiento: { etiqueta: "En taller", relleno: "#f5b700", borde: "#b88500" },
  inactivo: { etiqueta: "Inactivo", relleno: "#8c959b", borde: "#8c959b" },
};

export const ORDEN_SITUACIONES: Situacion[] = ["en_ruta", "retrasado", "sin_senal", "asignado", "disponible", "mantenimiento", "inactivo"];
