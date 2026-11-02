"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enviarConCola, pendientes, vaciarCola } from "@/lib/outbox";
import { fechaHora, hora, num, TIPO_INCIDENTE } from "@/lib/format";
import type { DatosConductor } from "@/lib/flota";

type Opcion = { id: number; nombre: string; placa: string | null };
type Aviso = { tipo: "ok" | "error" | "info"; texto: string } | null;
const CLAVE_ID = "l360_conductor_id";

export function AppConductor({ conductores }: { conductores: Opcion[] }) {
  const [id, setId] = useState<number | null>(null);
  const [datos, setDatos] = useState<DatosConductor | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [cargando, setCargando] = useState(false);
  const [enCola, setEnCola] = useState(0);
  const [compartiendo, setCompartiendo] = useState(false);
  const [ultimaPos, setUltimaPos] = useState<string | null>(null);
  const idRef = useRef<number | null>(null);
  const vehiculoRef = useRef<number | null>(null);

  const cargar = useCallback(async (conductorId: number) => {
    try {
      const r = await fetch(`/api/conductor/${conductorId}`, { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo cargar tu ruta.");
      const d: DatosConductor = await r.json();
      setDatos(d);
      vehiculoRef.current = d.vehiculo?.id ?? null;
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "Sin conexión. Se muestran los últimos datos." });
    }
  }, []);

  // Recordar quién es el conductor en este dispositivo
  useEffect(() => {
    const guardado = Number(localStorage.getItem(CLAVE_ID));
    if (guardado && conductores.some((c) => c.id === guardado)) setId(guardado);
    setEnCola(pendientes());
  }, [conductores]);

  useEffect(() => {
    idRef.current = id;
    if (id) void cargar(id);
  }, [id, cargar]);

  // Reenviar lo pendiente al recuperar la conexión
  useEffect(() => {
    const reenviar = async () => {
      if (!pendientes()) return;
      const quedan = await vaciarCola();
      setEnCola(quedan);
      if (!quedan) { setAviso({ tipo: "ok", texto: "Volvió la conexión: tus registros pendientes ya se enviaron." }); if (idRef.current) void cargar(idRef.current); }
    };
    window.addEventListener("online", reenviar);
    const t = setInterval(reenviar, 30000);
    return () => { window.removeEventListener("online", reenviar); clearInterval(t); };
  }, [cargar]);

  async function accion(url: string, cuerpo: unknown, textoOk: string) {
    setCargando(true);
    setAviso(null);
    const r = await enviarConCola(url, cuerpo);
    setCargando(false);
    setEnCola(pendientes());
    if (!r.ok) return setAviso({ tipo: "error", texto: r.error });
    setAviso(r.encolado ? { tipo: "info", texto: "Sin señal: lo guardamos en tu teléfono y lo enviamos al volver la conexión." } : { tipo: "ok", texto: textoOk });
    if (!r.encolado && idRef.current) await cargar(idRef.current);
    return true;
  }

  const enviarUbicacion = useCallback(() => {
    if (!navigator.geolocation) return setAviso({ tipo: "error", texto: "Este dispositivo no permite obtener la ubicación." });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const v = vehiculoRef.current;
        if (!v) return;
        const r = await enviarConCola("/api/gps", {
          vehiculo_id: v, lat: pos.coords.latitude, lng: pos.coords.longitude, velocidad_kmh: Math.round((pos.coords.speed ?? 0) * 3.6),
        });
        setEnCola(pendientes());
        if (r.ok) setUltimaPos(new Date().toISOString());
        else setAviso({ tipo: "error", texto: r.error });
      },
      () => setAviso({ tipo: "error", texto: "No pudimos leer tu ubicación. Activa el permiso de ubicación del navegador." }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    if (!compartiendo) return;
    enviarUbicacion();
    const t = setInterval(enviarUbicacion, 20000);
    return () => clearInterval(t);
  }, [compartiendo, enviarUbicacion]);

  const p = datos?.pedido;
  const v = datos?.vehiculo;

  return (
    <div className="movil">
      <div className="campo">
        <label htmlFor="conductor">¿Quién conduce?</label>
        <select
          id="conductor" value={id ?? ""}
          onChange={(e) => { const n = Number(e.target.value) || null; setId(n); setDatos(null); setAviso(null); if (n) localStorage.setItem(CLAVE_ID, String(n)); }}
        >
          <option value="">Elige tu nombre</option>
          {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.placa}</option>)}
        </select>
      </div>

      {aviso && <p className={`aviso ${aviso.tipo}`} role={aviso.tipo === "error" ? "alert" : "status"}>{aviso.texto}</p>}
      {enCola > 0 && <p className="aviso info pendiente-envio" role="status">{enCola} {enCola === 1 ? "registro pendiente" : "registros pendientes"} de enviar por falta de señal.</p>}

      {id && datos && (
        <>
          <section className="tarea" aria-label="Pedido actual">
            {p ? (
              <>
                <span className={`sello ${p.estado}`}>{p.estado === "asignado" ? "Por salir" : "En ruta"}</span>
                <div className="destino">{p.destino_ciudad}</div>
                <div>{p.destino_direccion}</div>
                <dl>
                  <dt>Pedido</dt><dd>{p.codigo}</dd>
                  <dt>Cliente</dt><dd>{p.cliente}</dd>
                  <dt>Carga</dt><dd className="num">{num(p.peso_kg)} kg desde {p.centro}</dd>
                  <dt>Distancia</dt><dd className="num">{num(p.distancia_km)} km</dd>
                  <dt>Entregar antes de</dt><dd className="num">{hora(p.prometido_en)} ({fechaHora(p.prometido_en).split(",")[0]})</dd>
                </dl>
                <div className="fila-botones">
                  {p.estado === "asignado"
                    ? <button className="boton grande verde" disabled={cargando} onClick={() => accion(`/api/pedidos/${p.id}/estado`, { estado: "en_ruta" }, "Ruta iniciada. El cliente ya ve que vas en camino.")}>Iniciar ruta</button>
                    : <button className="boton grande verde" disabled={cargando} onClick={() => accion(`/api/pedidos/${p.id}/estado`, { estado: "entregado" }, "Entrega confirmada. El cliente fue notificado.")}>Confirmar entrega</button>}
                </div>
              </>
            ) : (
              <>
                <div className="destino">Sin pedido asignado</div>
                <p className="vacio">{v?.estado === "activo" ? "Espera tu próxima asignación en el centro de distribución." : "Tu vehículo no está disponible para operar en este momento."}</p>
              </>
            )}
          </section>

          {v && (
            <section className="panel" aria-label="Ubicación">
              <div className="panel-cabeza"><h2>Mi ubicación</h2><span className="ayuda">Vehículo {v.placa}</span></div>
              <div className="panel-cuerpo">
                <p className="vacio" style={{ paddingTop: 0 }}>
                  {ultimaPos ? `Última ubicación enviada ${hora(ultimaPos)}.` : "Comparte tu posición para que despacho y el cliente sepan dónde vas."}
                </p>
                <div className="fila-botones" style={{ marginTop: 10 }}>
                  <button className="boton claro" onClick={enviarUbicacion}>Enviar ahora</button>
                  <button className={`boton ${compartiendo ? "advertencia" : "claro"}`} aria-pressed={compartiendo} onClick={() => setCompartiendo((c) => !c)}>
                    {compartiendo ? "Dejar de compartir" : "Compartir cada 20 s"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {v && (
            <section className="panel" aria-label="Combustible">
              <div className="panel-cabeza"><h2>Registrar combustible</h2></div>
              <form className="panel-cuerpo" onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const form = e.currentTarget;
                const ok = await accion("/api/combustible", { vehiculo_id: v.id, conductor_id: id, galones: Number(f.get("galones")), costo_cop: Number(f.get("costo")) }, "Carga de combustible registrada.");
                if (ok) form.reset();
              }}>
                <div className="rejilla-form">
                  <div className="campo"><label htmlFor="galones">Galones</label><input id="galones" name="galones" type="number" step="0.01" min="0.1" max="300" required inputMode="decimal" /></div>
                  <div className="campo"><label htmlFor="costo">Valor pagado (COP)</label><input id="costo" name="costo" type="number" min="0" required inputMode="numeric" /></div>
                </div>
                <div className="fila-botones"><button className="boton" disabled={cargando}>Guardar carga</button></div>
                {datos.ultimasCargas.length > 0 && (
                  <ul className="lista-simple">
                    {datos.ultimasCargas.map((c, i) => <li key={i}><span>{fechaHora(c.creado_en)}</span><span>{c.galones} gal · ${num(c.costo_cop)}</span></li>)}
                  </ul>
                )}
              </form>
            </section>
          )}

          {v && (
            <section className="panel" aria-label="Reportar incidente">
              <div className="panel-cabeza"><h2>Reportar un incidente</h2></div>
              <form className="panel-cuerpo" onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const form = e.currentTarget;
                const ok = await accion("/api/incidentes", { vehiculo_id: v.id, conductor_id: id, tipo: f.get("tipo"), descripcion: f.get("descripcion") }, "Incidente reportado. Despacho fue avisado.");
                if (ok) form.reset();
              }}>
                <div className="rejilla-form">
                  <div className="campo"><label htmlFor="tipo">Qué pasó</label>
                    <select id="tipo" name="tipo" defaultValue="falla_mecanica">{Object.entries(TIPO_INCIDENTE).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
                  <div className="campo"><label htmlFor="descripcion">Detalles</label><textarea id="descripcion" name="descripcion" maxLength={300} placeholder="Dónde estás y qué necesitas" /></div>
                </div>
                <div className="fila-botones"><button className="boton" disabled={cargando}>Enviar reporte</button></div>
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
}
