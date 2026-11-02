"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// Leaflet necesita `window`: se carga solo en el navegador.
const FleetMap = dynamic(() => import("./FleetMap"), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#566068" }}>Cargando mapa…</div>,
});

export function MapaFlota(props: ComponentProps<typeof FleetMap>) {
  return <FleetMap {...props} />;
}
