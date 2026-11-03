"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import { SITUACIONES } from "@/lib/situaciones";
import { hace } from "@/lib/format";
import type { Situacion, VehiculoMapa } from "@/lib/types";

export type PuntoMapa = { lat: number; lng: number; etiqueta: string; tipo: "origen" | "destino" };

type Props = {
  vehiculos: VehiculoMapa[];
  filtro?: Situacion | null;
  puntos?: PuntoMapa[];
  linea?: [number, number][];
  ajustarA?: "todo" | "puntos";
};

/** Encuadra el mapa una sola vez, al montarse; después el usuario conserva su zoom y desplazamiento. */
function AjustarUnaVez({ coords }: { coords: [number, number][] }) {
  const mapa = useMap();
  useEffect(() => {
    if (!coords.length) return;
    mapa.fitBounds(latLngBounds(coords), { padding: [34, 34], maxZoom: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function FleetMap({ vehiculos, filtro = null, puntos = [], linea, ajustarA = "todo" }: Props) {
  const visibles = filtro ? vehiculos.filter((v) => v.situacion === filtro) : vehiculos;
  const coordsAjuste: [number, number][] =
    ajustarA === "puntos"
      ? [...puntos.map((p) => [p.lat, p.lng] as [number, number]), ...vehiculos.map((v) => [v.lat, v.lng] as [number, number])]
      : vehiculos.map((v) => [v.lat, v.lng] as [number, number]);

  return (
    <MapContainer center={[8.6, -75.4]} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
           attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
   url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
   maxZoom={19}
      />
      <AjustarUnaVez coords={coordsAjuste} />
      {linea && <Polyline positions={linea} pathOptions={{ color: "#1d2327", weight: 3, dashArray: "8 8", opacity: 0.7 }} />}
      {puntos.map((p) => (
        <CircleMarker
          key={`${p.tipo}-${p.etiqueta}`}
          center={[p.lat, p.lng]}
          radius={10}
          pathOptions={
            p.tipo === "origen"
              ? { color: "#f5b700", weight: 4, fillColor: "#1d2327", fillOpacity: 1 }
              : { color: "#ffffff", weight: 3, fillColor: "#0e5a43", fillOpacity: 1 }
          }
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            {p.etiqueta}
          </Tooltip>
        </CircleMarker>
      ))}
      {visibles.map((v) => {
        const s = SITUACIONES[v.situacion];
        return (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
            radius={v.situacion === "retrasado" || v.situacion === "sin_senal" ? 8 : 6.5}
            pathOptions={{
              color: s.borde, weight: 2.5, fillColor: s.relleno, fillOpacity: 1,
              dashArray: s.discontinuo ? "3 3" : undefined,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{v.placa}</strong> · {s.etiqueta}
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 190, lineHeight: 1.4 }}>
                <strong style={{ fontSize: 17 }}>{v.placa}</strong> <span>({v.tipo})</span>
                <br />
                {s.etiqueta}
                {v.conductor && (<><br />Conductor: {v.conductor}</>)}
                {v.pedido && (<><br />Pedido {v.pedido}{v.destino ? ` → ${v.destino}` : ""}</>)}
                <br />
                {v.velocidad_kmh} km/h · señal {hace(v.ultima_senal)}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
