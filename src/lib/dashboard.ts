import { query, queryOne } from "./db";
import { TIPO_INCIDENTE } from "./format";
import type { Alerta, Dashboard, Situacion, VehiculoMapa } from "./types";

const TZ = "America/Bogota";
/** Minutos sin señal GPS a partir de los cuales un vehículo en operación se considera "sin señal". */
export const MIN_SIN_SENAL = 15;
/** Kilómetros de servicio tras los cuales el mantenimiento preventivo se considera vencido. */
export const KM_PREVENTIVO = 9000;

export async function obtenerDashboard(): Promise<Dashboard> {
  const [
    vehiculos, pedidosEstado, entregados24, retrasados, entregas7, combDias, combTop,
    costos, incidentes7, incidentesRec, mantAbiertas, mantVencidas, conductoresPuntualidad,
    pendientesViejos,
  ] = await Promise.all([
    query<{
      id: number; placa: string; tipo: string; estado: string; lat: number; lng: number; velocidad_kmh: number;
      ultima_senal: string | null; conductor: string | null; pedido: string | null; destino: string | null;
      pedido_estado: string | null; retrasado: boolean; sin_senal: boolean;
    }>(`
      SELECT v.id, v.placa, v.tipo, v.estado, v.lat, v.lng, v.velocidad_kmh, v.ultima_senal,
             c.nombre AS conductor, p.codigo AS pedido, p.destino_ciudad AS destino, p.estado AS pedido_estado,
             COALESCE(p.prometido_en < now(), false) AS retrasado,
             COALESCE(v.ultima_senal < now() - make_interval(mins => $1), true) AS sin_senal
      FROM vehiculos v
      LEFT JOIN conductores c ON c.id = v.conductor_id
      LEFT JOIN LATERAL (
        SELECT codigo, destino_ciudad, estado, prometido_en FROM pedidos
        WHERE vehiculo_id = v.id AND estado IN ('asignado','en_ruta') ORDER BY id DESC LIMIT 1
      ) p ON true
      WHERE v.lat IS NOT NULL
      ORDER BY v.id`, [MIN_SIN_SENAL]),
    query<{ estado: string; n: number }>(`SELECT estado, count(*) AS n FROM pedidos GROUP BY estado`),
    queryOne<{ n: number }>(`SELECT count(*) AS n FROM pedidos WHERE estado='entregado' AND entregado_en > now() - interval '24 hours'`),
    query<{ id: number; codigo: string; destino_ciudad: string; minutos: number; estado: string; placa: string | null }>(`
      SELECT p.id, p.codigo, p.destino_ciudad, p.estado,
             floor(extract(epoch FROM (now() - p.prometido_en)) / 60)::int AS minutos, v.placa
      FROM pedidos p LEFT JOIN vehiculos v ON v.id = p.vehiculo_id
      WHERE p.estado IN ('pendiente','asignado','en_ruta') AND p.prometido_en < now()
      ORDER BY p.prometido_en ASC`),
    queryOne<{ total: number; a_tiempo: number }>(`
      SELECT count(*) AS total, count(*) FILTER (WHERE entregado_en <= prometido_en) AS a_tiempo
      FROM pedidos WHERE estado='entregado' AND entregado_en > now() - interval '7 days'`),
    query<{ dia: string; galones: number; costo: number }>(`
      SELECT to_char((creado_en AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS dia,
             sum(galones)::float8 AS galones, sum(costo_cop)::float8 AS costo
      FROM cargas_combustible WHERE creado_en > now() - interval '8 days' GROUP BY 1 ORDER BY 1`),
    query<{ placa: string; galones: number; costo: number }>(`
      SELECT v.placa, sum(c.galones)::float8 AS galones, sum(c.costo_cop)::float8 AS costo
      FROM cargas_combustible c JOIN vehiculos v ON v.id = c.vehiculo_id
      WHERE c.creado_en > now() - interval '7 days' GROUP BY v.placa ORDER BY costo DESC LIMIT 5`),
    queryOne<{ combustible: number; mantenimiento: number; km: number; entregas: number }>(`
      SELECT
        (SELECT COALESCE(sum(costo_cop),0) FROM cargas_combustible WHERE creado_en > now() - interval '7 days')::float8 AS combustible,
        (SELECT COALESCE(sum(costo_cop),0) FROM ordenes_mantenimiento WHERE estado='cerrada' AND cerrada_en > now() - interval '7 days')::float8 AS mantenimiento,
        (SELECT COALESCE(sum(distancia_km),0) FROM pedidos WHERE estado='entregado' AND entregado_en > now() - interval '7 days')::float8 AS km,
        (SELECT count(*) FROM pedidos WHERE estado='entregado' AND entregado_en > now() - interval '7 days')::float8 AS entregas`),
    queryOne<{ n: number }>(`SELECT count(*) AS n FROM incidentes WHERE creado_en > now() - interval '7 days'`),
    query<{ id: number; tipo: string; placa: string; descripcion: string | null; creado_en: string }>(`
      SELECT i.id, i.tipo, v.placa, i.descripcion, i.creado_en
      FROM incidentes i JOIN vehiculos v ON v.id = i.vehiculo_id
      WHERE i.creado_en > now() - interval '7 days' ORDER BY i.creado_en DESC LIMIT 6`),
    query<{ id: number; placa: string; tipo: string; descripcion: string | null; creada_en: string }>(`
      SELECT o.id, v.placa, o.tipo, o.descripcion, o.creada_en
      FROM ordenes_mantenimiento o JOIN vehiculos v ON v.id = o.vehiculo_id
      WHERE o.estado='abierta' ORDER BY o.creada_en DESC LIMIT 8`),
    query<{ id: number; placa: string; km_excedidos: number }>(`
      SELECT id, placa, (km_total - km_ultimo_mantenimiento - ${KM_PREVENTIVO}) AS km_excedidos
      FROM vehiculos WHERE estado='activo' AND km_total - km_ultimo_mantenimiento >= ${KM_PREVENTIVO}
      ORDER BY km_excedidos DESC`),
    query<{ nombre: string; entregas: number; pct: number }>(`
      SELECT c.nombre, count(*) AS entregas,
             round(100.0 * count(*) FILTER (WHERE p.entregado_en <= p.prometido_en) / count(*))::int AS pct
      FROM pedidos p JOIN conductores c ON c.id = p.conductor_id
      WHERE p.estado='entregado' AND p.entregado_en > now() - interval '7 days'
      GROUP BY c.id, c.nombre HAVING count(*) >= 3 ORDER BY pct DESC, entregas DESC`),
    query<{ codigo: string; minutos: number }>(`
      SELECT codigo, floor(extract(epoch FROM (now() - creado_en)) / 60)::int AS minutos
      FROM pedidos WHERE estado='pendiente' AND creado_en < now() - interval '30 minutes' ORDER BY creado_en`),
  ]);

  // ---- Mapa y flota ----
  const mapa: VehiculoMapa[] = vehiculos.map((v) => {
    let situacion: Situacion;
    if (v.estado === "mantenimiento") situacion = "mantenimiento";
    else if (v.estado === "inactivo") situacion = "inactivo";
    else if (v.pedido_estado === "en_ruta" && v.sin_senal) situacion = "sin_senal";
    else if (v.pedido_estado && v.retrasado) situacion = "retrasado";
    else if (v.pedido_estado === "en_ruta") situacion = "en_ruta";
    else if (v.pedido_estado === "asignado") situacion = "asignado";
    else situacion = "disponible";
    return {
      id: v.id, placa: v.placa, tipo: v.tipo, lat: v.lat, lng: v.lng, velocidad_kmh: v.velocidad_kmh,
      ultima_senal: v.ultima_senal, conductor: v.conductor, pedido: v.pedido, destino: v.destino, situacion,
    };
  });
  const cuenta = (...s: Situacion[]) => mapa.filter((m) => s.includes(m.situacion)).length;

  // ---- Pedidos ----
  const porEstado = Object.fromEntries(pedidosEstado.map((r) => [r.estado, r.n])) as Record<string, number>;

  // ---- Entregas ----
  const total7 = entregas7?.total ?? 0;
  const aTiempo7 = entregas7?.a_tiempo ?? 0;

  // ---- Combustible: 7 días completos, rellenando días sin cargas ----
  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const dias: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  const porDia = dias.map((dia) => {
    const r = combDias.find((x) => x.dia === dia);
    return { dia, galones: r?.galones ?? 0, costo: r?.costo ?? 0 };
  });
  const galones7 = porDia.reduce((a, b) => a + b.galones, 0);
  const costoComb7 = porDia.reduce((a, b) => a + b.costo, 0);

  // ---- Costos ----
  const totalCostos = (costos?.combustible ?? 0) + (costos?.mantenimiento ?? 0);
  const km7 = costos?.km ?? 0;
  const ent7 = costos?.entregas ?? 0;

  // ---- Conductores ----
  const mejores = conductoresPuntualidad.slice(0, 3);
  const porMejorar = [...conductoresPuntualidad].reverse().slice(0, 3);

  // ---- Alertas ----
  const alertas: Alerta[] = [];
  for (const r of retrasados) {
    const h = r.minutos >= 60 ? `${Math.floor(r.minutos / 60)} h ${r.minutos % 60} min` : `${r.minutos} min`;
    alertas.push({
      id: `retraso-${r.id}`, nivel: r.minutos >= 60 ? "alta" : "media", tipo: "retraso",
      titulo: `Pedido ${r.codigo} con ${h} de retraso`,
      detalle: `Destino ${r.destino_ciudad}${r.placa ? ` · vehículo ${r.placa}` : " · sin vehículo asignado"}`,
      href: `/seguimiento/${r.codigo}`,
    });
  }
  for (const m of mapa.filter((x) => x.situacion === "sin_senal")) {
    alertas.push({
      id: `senal-${m.id}`, nivel: "alta", tipo: "senal",
      titulo: `Vehículo ${m.placa} sin señal GPS`,
      detalle: `Última señal ${m.ultima_senal ? new Date(m.ultima_senal).toLocaleTimeString("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) : "desconocida"} · lleva el pedido ${m.pedido ?? "—"}`,
      href: "/flota",
    });
  }
  for (const i of incidentesRec.filter((x) => Date.now() - new Date(x.creado_en).getTime() < 24 * 3600 * 1000)) {
    alertas.push({
      id: `inc-${i.id}`, nivel: i.tipo === "accidente" || i.tipo === "robo" ? "alta" : "media", tipo: "incidente",
      titulo: `${TIPO_INCIDENTE[i.tipo] ?? i.tipo} · ${i.placa}`, detalle: i.descripcion ?? "Sin descripción",
      cuando: i.creado_en, href: "/flota",
    });
  }
  for (const p of pendientesViejos) {
    alertas.push({
      id: `pend-${p.codigo}`, nivel: "media", tipo: "pedido",
      titulo: `Pedido ${p.codigo} sin vehículo hace ${p.minutos} min`,
      detalle: "No hay vehículo disponible con la capacidad necesaria", href: "/pedidos?estado=pendiente",
    });
  }
  if (mantVencidas.length) {
    alertas.push({
      id: "mant-vencido", nivel: "media", tipo: "mantenimiento",
      titulo: `${mantVencidas.length} ${mantVencidas.length === 1 ? "vehículo necesita" : "vehículos necesitan"} mantenimiento preventivo`,
      detalle: `Pasaron los ${KM_PREVENTIVO.toLocaleString("es-CO")} km desde el último servicio`, href: "/flota?vista=mantenimiento",
    });
  }
  alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alta" ? -1 : 1));

  return {
    generadoEn: new Date().toISOString(),
    flota: {
      total: mapa.length,
      en_ruta: cuenta("en_ruta", "retrasado", "sin_senal"),
      asignados: cuenta("asignado"),
      disponibles: cuenta("disponible"),
      mantenimiento: cuenta("mantenimiento"),
      inactivos: cuenta("inactivo"),
      sin_senal: cuenta("sin_senal"),
    },
    pedidos: {
      pendiente: porEstado.pendiente ?? 0,
      asignado: porEstado.asignado ?? 0,
      en_ruta: porEstado.en_ruta ?? 0,
      entregados_24h: entregados24?.n ?? 0,
      retrasados: retrasados.length,
    },
    entregas7d: { total: total7, a_tiempo: aTiempo7, pct_a_tiempo: total7 ? Math.round((100 * aTiempo7) / total7) : null },
    combustible: { galones_7d: galones7, costo_7d: costoComb7, porDia, topVehiculos: combTop },
    costos: {
      total_7d: totalCostos,
      por_km: km7 ? Math.round(totalCostos / km7) : null,
      por_entrega: ent7 ? Math.round(totalCostos / ent7) : null,
    },
    incidentes: {
      total_7d: incidentes7?.n ?? 0,
      ultimos: incidentesRec.map((i) => ({ tipo: i.tipo, placa: i.placa, descripcion: i.descripcion, creado_en: i.creado_en })),
    },
    mantenimiento: { abiertas: mantAbiertas, preventivasVencidas: mantVencidas },
    conductores: { mejores, porMejorar },
    alertas: alertas.slice(0, 14),
    totalAlertas: alertas.length,
    mapa,
  };
}
