import { query, queryOne, transaccion } from "./db";
import { ErrorDeNegocio } from "./pedidos";
import { KM_PREVENTIVO, MIN_SIN_SENAL } from "./dashboard";

export type VehiculoFila = {
  id: number; placa: string; tipo: string; capacidad_kg: number; estado: string; centro: string; conductor: string | null;
  km_total: number; km_desde_servicio: number; ultima_senal: string | null; sin_senal: boolean;
  pedido: string | null; pedido_estado: string | null; destino: string | null;
};

export async function listarFlota(opts: { estado?: string; q?: string } = {}): Promise<VehiculoFila[]> {
  const where: string[] = [];
  const params: unknown[] = [MIN_SIN_SENAL];
  if (opts.estado && opts.estado !== "todos") {
    params.push(opts.estado);
    where.push(`v.estado = $${params.length}`);
  }
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim()}%`);
    where.push(`(v.placa ILIKE $${params.length} OR c.nombre ILIKE $${params.length} OR ce.ciudad ILIKE $${params.length})`);
  }
  return query<VehiculoFila>(
    `SELECT v.id, v.placa, v.tipo, v.capacidad_kg, v.estado, ce.nombre AS centro, c.nombre AS conductor,
            v.km_total, (v.km_total - v.km_ultimo_mantenimiento) AS km_desde_servicio, v.ultima_senal,
            COALESCE(v.ultima_senal < now() - make_interval(mins => $1), true) AS sin_senal,
            p.codigo AS pedido, p.estado AS pedido_estado, p.destino_ciudad AS destino
     FROM vehiculos v
     LEFT JOIN centros ce ON ce.id = v.centro_id
     LEFT JOIN conductores c ON c.id = v.conductor_id
     LEFT JOIN LATERAL (SELECT codigo, estado, destino_ciudad FROM pedidos WHERE vehiculo_id = v.id AND estado IN ('asignado','en_ruta') ORDER BY id DESC LIMIT 1) p ON true
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY v.placa`,
    params
  );
}

export type OrdenMantenimiento = {
  id: number; vehiculo_id: number; placa: string; tipo: string; estado: string; descripcion: string | null; costo_cop: number; creada_en: string; cerrada_en: string | null;
};

export async function listarOrdenes(estado: "abierta" | "cerrada", limite = 15): Promise<OrdenMantenimiento[]> {
  return query<OrdenMantenimiento>(
    `SELECT o.id, o.vehiculo_id, v.placa, o.tipo, o.estado, o.descripcion, o.costo_cop, o.creada_en, o.cerrada_en
     FROM ordenes_mantenimiento o JOIN vehiculos v ON v.id = o.vehiculo_id
     WHERE o.estado = $1 ORDER BY COALESCE(o.cerrada_en, o.creada_en) DESC LIMIT $2`,
    [estado, limite]
  );
}

/** Los que ya pasaron el umbral de km desde el último servicio y siguen operando. */
export async function preventivosPendientes() {
  return query<{ id: number; placa: string; tipo: string; km_desde_servicio: number }>(
    `SELECT id, placa, tipo, (km_total - km_ultimo_mantenimiento) AS km_desde_servicio
     FROM vehiculos WHERE estado = 'activo' AND km_total - km_ultimo_mantenimiento >= $1
     ORDER BY km_desde_servicio DESC`, [KM_PREVENTIVO]
  );
}

export async function abrirMantenimiento(vehiculoId: number, tipo: "preventivo" | "correctivo", descripcion: string) {
  return transaccion(async (q) => {
    const [v] = await q<{ estado: string }>(`SELECT estado FROM vehiculos WHERE id = $1 FOR UPDATE`, [vehiculoId]);
    if (!v) throw new ErrorDeNegocio("El vehículo no existe.", 404);
    if (v.estado === "mantenimiento") throw new ErrorDeNegocio("El vehículo ya está en mantenimiento.", 409);
    const [enCurso] = await q<{ n: number }>(
      `SELECT count(*) AS n FROM pedidos WHERE vehiculo_id = $1 AND estado IN ('asignado','en_ruta')`, [vehiculoId]
    );
    if (enCurso.n > 0) throw new ErrorDeNegocio("El vehículo tiene un pedido en curso. Termina o reasigna el pedido primero.", 409);
    await q(`UPDATE vehiculos SET estado = 'mantenimiento', velocidad_kmh = 0 WHERE id = $1`, [vehiculoId]);
    const [o] = await q<{ id: number }>(
      `INSERT INTO ordenes_mantenimiento (vehiculo_id, tipo, descripcion) VALUES ($1,$2,$3) RETURNING id`,
      [vehiculoId, tipo, descripcion.trim() || (tipo === "preventivo" ? "Servicio preventivo programado" : "Reparación")]
    );
    return { id: o.id };
  });
}

export async function cerrarMantenimiento(ordenId: number, costo: number) {
  if (!Number.isFinite(costo) || costo < 0) throw new ErrorDeNegocio("El costo no es válido.");
  return transaccion(async (q) => {
    const [o] = await q<{ vehiculo_id: number; estado: string }>(`SELECT vehiculo_id, estado FROM ordenes_mantenimiento WHERE id = $1 FOR UPDATE`, [ordenId]);
    if (!o) throw new ErrorDeNegocio("La orden no existe.", 404);
    if (o.estado === "cerrada") throw new ErrorDeNegocio("La orden ya está cerrada.", 409);
    await q(`UPDATE ordenes_mantenimiento SET estado='cerrada', cerrada_en=now(), costo_cop=$1 WHERE id=$2`, [Math.round(costo), ordenId]);
    await q(`UPDATE vehiculos SET estado='activo', km_ultimo_mantenimiento = km_total WHERE id = $1`, [o.vehiculo_id]);
    return { ok: true };
  });
}

// ---------- Ingesta desde dispositivos / app del conductor ----------

export async function registrarGps(input: { vehiculo_id?: number; placa?: string; lat: number; lng: number; velocidad_kmh?: number }) {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
    throw new ErrorDeNegocio("Coordenadas inválidas.");
  }
  const v = input.vehiculo_id
    ? await queryOne<{ id: number }>(`SELECT id FROM vehiculos WHERE id = $1`, [input.vehiculo_id])
    : await queryOne<{ id: number }>(`SELECT id FROM vehiculos WHERE upper(placa) = upper($1)`, [input.placa ?? ""]);
  if (!v) throw new ErrorDeNegocio("Vehículo no encontrado.", 404);
  const vel = Math.max(0, Math.round(input.velocidad_kmh ?? 0));
  await query(`UPDATE vehiculos SET lat=$1, lng=$2, velocidad_kmh=$3, ultima_senal=now() WHERE id=$4`, [input.lat, input.lng, vel, v.id]);
  await query(`INSERT INTO eventos_gps (vehiculo_id, lat, lng, velocidad_kmh) VALUES ($1,$2,$3,$4)`, [v.id, input.lat, input.lng, vel]);
  return { ok: true };
}

export async function registrarCombustible(input: { vehiculo_id: number; conductor_id?: number; galones: number; costo_cop: number }) {
  if (!(input.galones > 0 && input.galones <= 300)) throw new ErrorDeNegocio("Los galones deben estar entre 0 y 300.");
  if (!(input.costo_cop >= 0 && input.costo_cop <= 5_000_000)) throw new ErrorDeNegocio("El costo no es válido.");
  const [pedido] = await query<{ id: number }>(
    `SELECT id FROM pedidos WHERE vehiculo_id = $1 AND estado IN ('asignado','en_ruta') ORDER BY id DESC LIMIT 1`, [input.vehiculo_id]
  );
  await query(
    `INSERT INTO cargas_combustible (vehiculo_id, pedido_id, conductor_id, galones, costo_cop) VALUES ($1,$2,$3,$4,$5)`,
    [input.vehiculo_id, pedido?.id ?? null, input.conductor_id ?? null, input.galones, Math.round(input.costo_cop)]
  );
  return { ok: true };
}

export async function registrarIncidente(input: { vehiculo_id: number; conductor_id?: number; tipo: string; descripcion?: string }) {
  if (!["accidente", "falla_mecanica", "desvio", "robo", "otro"].includes(input.tipo)) throw new ErrorDeNegocio("Tipo de incidente no válido.");
  const v = await queryOne<{ lat: number | null; lng: number | null }>(`SELECT lat, lng FROM vehiculos WHERE id = $1`, [input.vehiculo_id]);
  if (!v) throw new ErrorDeNegocio("Vehículo no encontrado.", 404);
  await query(
    `INSERT INTO incidentes (vehiculo_id, conductor_id, tipo, descripcion, lat, lng) VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.vehiculo_id, input.conductor_id ?? null, input.tipo, input.descripcion?.trim() || null, v.lat, v.lng]
  );
  return { ok: true };
}

// ---------- App del conductor ----------

export async function listarConductores() {
  return query<{ id: number; nombre: string; placa: string | null }>(
    `SELECT c.id, c.nombre, v.placa FROM conductores c LEFT JOIN vehiculos v ON v.conductor_id = c.id
     WHERE c.activo AND v.estado = 'activo' ORDER BY c.nombre`
  );
}

export type DatosConductor = {
  conductor: { id: number; nombre: string };
  vehiculo: { id: number; placa: string; tipo: string; estado: string } | null;
  pedido: {
    id: number; codigo: string; estado: string; cliente: string; destino_ciudad: string; destino_direccion: string; peso_kg: number;
    prometido_en: string; distancia_km: number; centro: string;
  } | null;
  ultimasCargas: { galones: number; costo_cop: number; creado_en: string }[];
};

export async function datosConductor(id: number): Promise<DatosConductor | null> {
  const conductor = await queryOne<{ id: number; nombre: string }>(`SELECT id, nombre FROM conductores WHERE id = $1`, [id]);
  if (!conductor) return null;
  const vehiculo = await queryOne<{ id: number; placa: string; tipo: string; estado: string }>(
    `SELECT id, placa, tipo, estado FROM vehiculos WHERE conductor_id = $1`, [id]
  );
  const pedido = vehiculo
    ? await queryOne<DatosConductor["pedido"] & object>(
        `SELECT p.id, p.codigo, p.estado, cl.nombre AS cliente, p.destino_ciudad, p.destino_direccion, p.peso_kg, p.prometido_en, p.distancia_km, ce.nombre AS centro
         FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id JOIN centros ce ON ce.id = p.centro_id
         WHERE p.vehiculo_id = $1 AND p.estado IN ('asignado','en_ruta') ORDER BY p.id DESC LIMIT 1`, [vehiculo.id])
    : null;
  const ultimasCargas = vehiculo
    ? await query<{ galones: number; costo_cop: number; creado_en: string }>(
        `SELECT galones, costo_cop, creado_en FROM cargas_combustible WHERE vehiculo_id = $1 ORDER BY creado_en DESC LIMIT 3`, [vehiculo.id])
    : [];
  return { conductor, vehiculo, pedido, ultimasCargas };
}
