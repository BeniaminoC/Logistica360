"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CIUDADES } from "@/lib/ciudades";
import { enviarJson } from "@/lib/cliente";

type Resultado = { codigo: string; asignacion: { ok: true; vehiculo: string; conductor: string | null; distanciaAlCentroKm: number } | { ok: false; motivo: string } };

export function FormPedido({ centros, clientes }: { centros: { id: number; nombre: string }[]; clientes: { id: number; nombre: string }[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setError(null);
    setResultado(null);
    const r = await enviarJson<Resultado>("/api/pedidos", {
      cliente_nombre: f.get("cliente"),
      centro_id: Number(f.get("centro")),
      destino_ciudad: f.get("ciudad"),
      destino_direccion: f.get("direccion"),
      peso_kg: Number(f.get("peso")),
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setResultado(r.datos);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <>
      <button className="boton advertencia" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        {abierto ? "Cerrar formulario" : "Nuevo pedido"}
      </button>
      {abierto && (
        <section className="panel panel-nuevo" style={{ flexBasis: "100%", order: 5 }} aria-label="Nuevo pedido">
          <div className="panel-cabeza"><h2>Registrar pedido</h2><span className="ayuda">El sistema asigna el vehículo y el conductor más cercanos con capacidad.</span></div>
          <form className="panel-cuerpo" onSubmit={enviar}>
            <div className="rejilla-form">
              <div className="campo">
                <label htmlFor="cliente">Cliente</label>
                <input id="cliente" name="cliente" list="lista-clientes" required placeholder="Nombre de la empresa" autoComplete="off" />
                <datalist id="lista-clientes">{clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
              </div>
              <div className="campo">
                <label htmlFor="centro">Sale del centro</label>
                <select id="centro" name="centro" required>{centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
              </div>
              <div className="campo">
                <label htmlFor="ciudad">Ciudad de entrega</label>
                <select id="ciudad" name="ciudad" required defaultValue="Sincelejo">{CIUDADES.map((c) => <option key={c.ciudad}>{c.ciudad}</option>)}</select>
              </div>
              <div className="campo">
                <label htmlFor="direccion">Dirección de entrega</label>
                <input id="direccion" name="direccion" required placeholder="Carrera 12 # 34-56, barrio" />
              </div>
              <div className="campo">
                <label htmlFor="peso">Peso (kg)</label>
                <input id="peso" name="peso" type="number" min={1} max={30000} required inputMode="numeric" placeholder="1200" />
              </div>
            </div>
            <div className="fila-botones">
              <button className="boton verde" type="submit" disabled={enviando}>{enviando ? "Registrando…" : "Registrar y asignar"}</button>
            </div>
            {error && <p className="aviso error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
            {resultado && (
              <p className={`aviso ${resultado.asignacion.ok ? "ok" : "info"}`} role="status" style={{ marginTop: 14 }}>
                Pedido <strong>{resultado.codigo}</strong> registrado.{" "}
                {resultado.asignacion.ok
                  ? `Asignado al vehículo ${resultado.asignacion.vehiculo}${resultado.asignacion.conductor ? ` (${resultado.asignacion.conductor})` : ""}, a ${resultado.asignacion.distanciaAlCentroKm} km del centro.`
                  : resultado.asignacion.motivo}
              </p>
            )}
          </form>
        </section>
      )}
    </>
  );
}
