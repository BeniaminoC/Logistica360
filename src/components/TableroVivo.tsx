"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapaFlota } from "./MapaFlota";
import { BarrasPorDia, FilaBarra } from "./Graficas";
import { SITUACIONES, ORDEN_SITUACIONES } from "@/lib/situaciones";
import { copCorto, fechaHora, hace, num, TIPO_INCIDENTE } from "@/lib/format";
import type { Dashboard, Situacion } from "@/lib/types";

const CADA_MS = 6000;
const CADA_SIM_MS = 4000;

export function TableroVivo({ inicial, demo }: { inicial: Dashboard; demo: boolean }) {
  const [d, setD] = useState<Dashboard>(inicial);
  const [filtro, setFiltro] = useState<Situacion | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const ocupado = useRef(false);

  const refrescar = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "No se pudo actualizar");
      setD(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sin conexión");
    }
  }, []);

  // Actualización periódica (pausada si la pestaña no está visible)
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden && !ocupado.current) void refrescar(); }, CADA_MS);
    return () => clearInterval(id);
  }, [refrescar]);

  // Reloj para "actualizado hace…"
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Simulación: cada paso mueve la flota y luego se vuelve a leer el tablero
  useEffect(() => {
    if (!simulando) return;
    const paso = async () => {
      if (document.hidden || ocupado.current) return;
      ocupado.current = true;
      try {
        const r = await fetch("/api/simulador/tick", { method: "POST" });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "La simulación falló");
        await refrescar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "La simulación falló");
        setSimulando(false);
      } finally {
        ocupado.current = false;
      }
    };
    void paso();
    const id = setInterval(paso, CADA_SIM_MS);
    return () => clearInterval(id);
  }, [simulando, refrescar]);

  const { flota, pedidos, entregas7d, combustible, costos, incidentes, mantenimiento, conductores } = d;
  const enCurso = pedidos.pendiente + pedidos.asignado + pedidos.en_ruta;
  const maxPedidos = Math.max(pedidos.pendiente, pedidos.asignado, pedidos.en_ruta, pedidos.entregados_24h, pedidos.retrasados, 1);
  const conteoSit = (s: Situacion) => d.mapa.filter((m) => m.situacion === s).length;
  const segundos = Math.max(0, Math.round((ahora - new Date(d.generadoEn).getTime()) / 1000));

  return (
    <>
      <header className="encabezado">
        <div>
          <h1 className="cartel">Centro de control</h1>
        </div>
        <div className="acciones-encabezado">
          <span className="estado-datos" role="status">
            <span className={`punto ${error ? "error" : "vivo"}`} aria-hidden="true" />
            {error ? error : segundos < 5 ? "Actualizado ahora" : `Actualizado hace ${segundos} s`}
          </span>
          {demo && (
            <button className={`boton ${simulando ? "advertencia" : "claro"}`} onClick={() => setSimulando((s) => !s)} aria-pressed={simulando}>
              {simulando ? "Detener simulación de GPS" : "Simular GPS en vivo"}
            </button>
          )}
        </div>
      </header>

      <section className="indicadores" aria-label="Indicadores principales">
        <div className="indicador">
          <div className="valor num">{flota.en_ruta}<small>de {flota.total}</small></div>
          <div className="nombre">Vehículos en ruta</div>
          <div className="detalle">{flota.disponibles} disponibles · {flota.mantenimiento} en taller · {flota.inactivos} inactivos</div>
        </div>
        <div className="indicador">
          <div className="valor num">{enCurso}</div>
          <div className="nombre">Pedidos en curso</div>
          <div className="detalle">{pedidos.pendiente} sin vehículo · {pedidos.en_ruta} en ruta</div>
        </div>
        <div className="indicador">
          <div className="valor num">{pedidos.entregados_24h}</div>
          <div className="nombre">Entregas en 24 horas</div>
          <div className="detalle">
            {entregas7d.pct_a_tiempo === null ? "Sin entregas esta semana" : `${entregas7d.pct_a_tiempo}% a tiempo en 7 días`}
          </div>
        </div>
        <div className={`indicador ${pedidos.retrasados > 0 ? "critico" : "bueno"}`}>
          <div className="valor num">{pedidos.retrasados}</div>
          <div className="nombre">Pedidos con retraso</div>
          <div className="detalle">{flota.sin_senal} {flota.sin_senal === 1 ? "vehículo" : "vehículos"} sin señal GPS</div>
        </div>
        <div className="indicador">
          <div className="valor num">{num(Math.round(combustible.galones_7d))}<small>gal</small></div>
          <div className="nombre">Combustible, 7 días</div>
          <div className="detalle">{copCorto(combustible.costo_7d)} en total</div>
        </div>
        <div className="indicador">
          <div className="valor num">{costos.por_km === null ? "—" : `$${num(costos.por_km)}`}<small>/ km</small></div>
          <div className="nombre">Costo por kilómetro</div>
          <div className="detalle">{costos.por_entrega === null ? "Sin entregas" : `${copCorto(costos.por_entrega)} por entrega`}</div>
        </div>
      </section>

      <div className="fila-mapa">
        <section className="panel mapa-panel" aria-label="Mapa de la flota">
          <div className="panel-cabeza">
            <h2>Flota en el mapa</h2>
            <span className="ayuda">{filtro ? `${conteoSit(filtro)} ${SITUACIONES[filtro].etiqueta.toLowerCase()}` : `${d.mapa.length} vehículos`}</span>
          </div>
          <div className="mapa-caja">
            <MapaFlota vehiculos={d.mapa} filtro={filtro} />
          </div>
          <div className="leyenda" style={{ paddingTop: 12 }}>
            {ORDEN_SITUACIONES.map((s) => {
              const sit = SITUACIONES[s];
              return (
                <button key={s} aria-pressed={filtro === s} onClick={() => setFiltro(filtro === s ? null : s)}>
                  <span className="marca-sit" style={{ background: sit.relleno, borderColor: sit.borde, borderStyle: sit.discontinuo ? "dashed" : "solid" }} aria-hidden="true" />
                  {sit.etiqueta} <span className="num">{conteoSit(s)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel" aria-label="Alertas">
          <div className="panel-cabeza">
            <h2>Alertas que requieren acción</h2>
            <span className="ayuda">{d.totalAlertas}</span>
          </div>
          {d.alertas.length === 0 ? (
            <p className="sin-alertas">Todo en orden: no hay retrasos, vehículos sin señal ni incidentes abiertos.</p>
          ) : (
            <ul className="alertas">
              {d.alertas.map((a) => (
                <li key={a.id}>
                  <Link href={a.href ?? "#"} className={`alerta ${a.nivel}`}>
                    <div className="barra" aria-hidden="true" />
                    <div>
                      <strong>{a.titulo}</strong>
                      <span>{a.detalle}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="fila-paneles">
        <section className="panel">
          <div className="panel-cabeza">
            <h2>Pedidos por estado</h2>
            <Link href="/pedidos">Ver pedidos</Link>
          </div>
          <div className="panel-cuerpo">
            <FilaBarra etiqueta="Sin vehículo" valor={pedidos.pendiente} maximo={maxPedidos} color="#f5b700" />
            <FilaBarra etiqueta="Por salir" valor={pedidos.asignado} maximo={maxPedidos} color="#7fb0dc" />
            <FilaBarra etiqueta="En ruta" valor={pedidos.en_ruta} maximo={maxPedidos} color="#1f6fb5" />
            <FilaBarra etiqueta="Entregados 24 h" valor={pedidos.entregados_24h} maximo={maxPedidos} color="#0e5a43" />
            <FilaBarra etiqueta="Con retraso" valor={pedidos.retrasados} maximo={maxPedidos} color="#c4372a" />
          </div>
        </section>

        <section className="panel">
          <div className="panel-cabeza">
            <h2>Combustible por día</h2>
            <span className="ayuda">galones</span>
          </div>
          <div className="panel-cuerpo">
            <BarrasPorDia datos={combustible.porDia} />
            <p className="subtitulo">Mayor gasto en 7 días</p>
            <ul className="lista-simple">
              {combustible.topVehiculos.slice(0, 3).map((v) => (
                <li key={v.placa}><span>{v.placa}</span><span>{num(Math.round(v.galones))} gal · {copCorto(v.costo)}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel-cabeza">
            <h2>Mantenimiento</h2>
            <Link href="/flota?vista=mantenimiento">Abrir taller</Link>
          </div>
          <div className="panel-cuerpo">
            <p className="subtitulo" style={{ marginTop: 0 }}>{mantenimiento.abiertas.length} en taller ahora</p>
            {mantenimiento.abiertas.length === 0 ? <p className="vacio">Ningún vehículo en taller.</p> : (
              <ul className="lista-simple">
                {mantenimiento.abiertas.slice(0, 4).map((o) => (
                  <li key={o.id}><span>{o.placa} · {o.tipo}</span><span>{o.descripcion}</span></li>
                ))}
              </ul>
            )}
            <p className="subtitulo">{mantenimiento.preventivasVencidas.length} con servicio preventivo vencido</p>
            {mantenimiento.preventivasVencidas.length === 0 ? <p className="vacio">Todos al día.</p> : (
              <ul className="lista-simple">
                {mantenimiento.preventivasVencidas.slice(0, 3).map((v) => (
                  <li key={v.id}><span>{v.placa}</span><span>{num(v.km_excedidos)} km de más</span></li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-cabeza">
            <h2>Seguridad y conductores</h2>
          </div>
          <div className="panel-cuerpo">
            <div className="cifra-grande num">{incidentes.total_7d}</div>
            <p className="vacio" style={{ paddingTop: 2 }}>incidentes y accidentes en 7 días</p>
            <ul className="lista-simple">
              {incidentes.ultimos.slice(0, 3).map((i, k) => (
                <li key={k}><span>{TIPO_INCIDENTE[i.tipo] ?? i.tipo} · {i.placa}</span><span>{hace(i.creado_en, ahora)}</span></li>
              ))}
            </ul>
            <p className="subtitulo">Puntualidad de conductores (7 días)</p>
            {conductores.mejores.length === 0 ? <p className="vacio">Aún no hay suficientes entregas.</p> : (
              <ul className="lista-simple">
                {conductores.mejores.slice(0, 2).map((c) => (
                  <li key={`m-${c.nombre}`}><span>{c.nombre}</span><span>{c.pct}% · {c.entregas} entregas</span></li>
                ))}
                {conductores.porMejorar.slice(0, 2).map((c) => (
                  <li key={`p-${c.nombre}`}><span>{c.nombre}</span><span style={{ color: "var(--rojo)" }}>{c.pct}% · {c.entregas} entregas</span></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      <p className="vacio" style={{ marginTop: 18 }}>
        Datos de {fechaHora(d.generadoEn)}. {demo ? "Los vehículos de esta demostración se mueven con un simulador; con dispositivos reales llegan por POST /api/gps." : ""}
      </p>
    </>
  );
}
