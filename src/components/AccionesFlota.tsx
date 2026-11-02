"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { enviarJson } from "@/lib/cliente";

/** Envía un vehículo al taller (abre una orden de mantenimiento). */
export function BotonTaller({ vehiculoId, tipoInicial = "preventivo", etiqueta = "Enviar al taller" }: { vehiculoId: number; tipoInicial?: "preventivo" | "correctivo"; etiqueta?: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setError(null);
    const r = await enviarJson("/api/mantenimiento", { vehiculo_id: vehiculoId, tipo: f.get("tipo"), descripcion: f.get("descripcion") });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) return <button className="boton chico claro" onClick={() => setAbierto(true)}>{etiqueta}</button>;
  return (
    <form onSubmit={enviar} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
      <select name="tipo" defaultValue={tipoInicial} aria-label="Tipo de mantenimiento" className="boton claro chico" style={{ background: "#fff" }}>
        <option value="preventivo">Preventivo</option>
        <option value="correctivo">Correctivo</option>
      </select>
      <input name="descripcion" placeholder="Qué se hará" aria-label="Descripción" style={{ minHeight: 32, padding: "4px 8px", border: "1.5px solid #9aa3a8", borderRadius: 6, width: 160 }} />
      <button className="boton chico verde" disabled={enviando}>{enviando ? "…" : "Abrir orden"}</button>
      <button type="button" className="enlace" onClick={() => setAbierto(false)}>Cancelar</button>
      {error && <span role="alert" style={{ color: "var(--rojo)", fontSize: 13, flexBasis: "100%", textAlign: "right" }}>{error}</span>}
    </form>
  );
}

/** Cierra una orden: registra el costo y devuelve el vehículo a operación. */
export function CerrarOrden({ ordenId }: { ordenId: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const costo = Number(new FormData(e.currentTarget).get("costo"));
    setEnviando(true);
    setError(null);
    const r = await enviarJson(`/api/mantenimiento/${ordenId}/cerrar`, { costo_cop: costo });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  if (!abierto) return <button className="boton chico verde" onClick={() => setAbierto(true)}>Cerrar orden</button>;
  return (
    <form onSubmit={enviar} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
      <input name="costo" type="number" min={0} required placeholder="Costo en COP" aria-label="Costo en pesos" inputMode="numeric" style={{ minHeight: 32, padding: "4px 8px", border: "1.5px solid #9aa3a8", borderRadius: 6, width: 130 }} />
      <button className="boton chico verde" disabled={enviando}>{enviando ? "…" : "Devolver a operación"}</button>
      <button type="button" className="enlace" onClick={() => setAbierto(false)}>Cancelar</button>
      {error && <span role="alert" style={{ color: "var(--rojo)", fontSize: 13, flexBasis: "100%", textAlign: "right" }}>{error}</span>}
    </form>
  );
}
