"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { enviarJson } from "@/lib/cliente";

export function AccionesPedido({ id, estado }: { id: number; estado: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error" | "info"; texto: string } | null>(null);

  async function ejecutar(url: string, cuerpo?: unknown) {
    setCargando(true);
    setMensaje(null);
    const r = await enviarJson<{ ok?: boolean; vehiculo?: string; motivo?: string }>(url, cuerpo);
    setCargando(false);
    if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
    if (r.datos.ok === false) return setMensaje({ tipo: "info", texto: r.datos.motivo ?? "No se pudo asignar." });
    router.refresh();
  }

  if (estado === "entregado" || estado === "cancelado") return null;
  return (
    <div className="acciones-fila">
      {mensaje && <span className="tenue" role="status" style={{ color: mensaje.tipo === "error" ? "var(--rojo)" : undefined, maxWidth: 220 }}>{mensaje.texto}</span>}
      {estado === "pendiente" && (
        <button className="boton chico verde" disabled={cargando} onClick={() => ejecutar(`/api/pedidos/${id}/asignar`)}>Asignar vehículo</button>
      )}
      {estado === "asignado" && (
        <button className="boton chico" disabled={cargando} onClick={() => ejecutar(`/api/pedidos/${id}/estado`, { estado: "en_ruta" })}>Registrar salida</button>
      )}
      {estado === "en_ruta" && (
        <button className="boton chico" disabled={cargando} onClick={() => ejecutar(`/api/pedidos/${id}/estado`, { estado: "entregado" })}>Confirmar entrega</button>
      )}
      {(estado === "pendiente" || estado === "asignado") && (
        <button
          className="enlace" disabled={cargando}
          onClick={() => { if (confirm("¿Cancelar este pedido? El cliente verá que fue cancelado.")) void ejecutar(`/api/pedidos/${id}/estado`, { estado: "cancelado" }); }}
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
