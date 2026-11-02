import { query, queryOne } from "./db";
import { avanzar } from "./geo";
import { CIUDADES } from "./ciudades";
import { asignarPedido, crearPedido } from "./pedidos";
import { MIN_SIN_SENAL } from "./dashboard";

/**
 * Simulador de operación para demostraciones: mueve los vehículos hacia su destino, cierra entregas,
 * recibe pedidos nuevos y los asigna. Sustituye a los GPS reales cuando no hay dispositivos conectados.
 * Cada "tick" representa unos pocos minutos de operación real (el tiempo está acelerado).
 */
export function simuladorActivo() {
  return process.env.DEMO_MODE !== "false";
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const entre = (a: number, b: number) => a + Math.random() * (b - a);

export type ResumenTick = { movidos: number; salidas: number; entregados: number; pedidosNuevos: number; asignados: number; reconectados: number };

export async function ejecutarTick(): Promise<ResumenTick> {
  const resumen: ResumenTick = { movidos: 0, salidas: 0, entregados: 0, pedidosNuevos: 0, asignados: 0, reconectados: 0 };

  // 1) Vehículos con pedido en ruta avanzan hacia el destino.
  const enRuta = await query<{
    pedido_id: number; vehiculo_id: number; lat: number; lng: number; destino_lat: number; destino_lng: number; sin_senal: boolean;
  }>(
    `SELECT p.id AS pedido_id, v.id AS vehiculo_id, v.lat, v.lng, p.destino_lat, p.destino_lng,
            COALESCE(v.ultima_senal < now() - make_interval(mins => $1), true) AS sin_senal
     FROM pedidos p JOIN vehiculos v ON v.id = p.vehiculo_id
     WHERE p.estado = 'en_ruta' AND v.estado = 'activo'`, [MIN_SIN_SENAL]
  );

  const reconectar: number[] = [];
  const mover = { id: [] as number[], lat: [] as number[], lng: [] as number[], vel: [] as number[], km: [] as number[] };
  const llegaron: number[] = [];
  const llegaronVeh: number[] = [];
  for (const r of enRuta) {
    if (r.sin_senal) {
      // Sin señal: el vehículo sigue su camino pero no reporta. A veces recupera cobertura.
      if (Math.random() < 0.03) { reconectar.push(r.vehiculo_id); resumen.reconectados++; }
      continue;
    }
    const paso = entre(6, 14); // km simulados por tick
    const nueva = avanzar(r.lat, r.lng, r.destino_lat, r.destino_lng, paso);
    mover.id.push(r.vehiculo_id);
    mover.lat.push(nueva.lat);
    mover.lng.push(nueva.lng);
    mover.vel.push(nueva.llego ? 0 : Math.round(entre(48, 78)));
    mover.km.push(Math.round(paso));
    if (nueva.llego) { llegaron.push(r.pedido_id); llegaronVeh.push(r.vehiculo_id); }
  }
  if (mover.id.length) {
    await query(
      `UPDATE vehiculos v SET lat = t.lat, lng = t.lng, velocidad_kmh = t.vel, km_total = v.km_total + t.km, ultima_senal = now()
       FROM unnest($1::int[], $2::float8[], $3::float8[], $4::int[], $5::int[]) AS t(id, lat, lng, vel, km) WHERE v.id = t.id`,
      [mover.id, mover.lat, mover.lng, mover.vel, mover.km]
    );
    await query(
      `INSERT INTO eventos_gps (vehiculo_id, lat, lng, velocidad_kmh)
       SELECT * FROM unnest($1::int[], $2::float8[], $3::float8[], $4::int[])`,
      [mover.id, mover.lat, mover.lng, mover.vel]
    );
    resumen.movidos = mover.id.length;
  }
  if (reconectar.length) await query(`UPDATE vehiculos SET ultima_senal = now() WHERE id = ANY($1::int[])`, [reconectar]);
  if (llegaron.length) {
    await query(`UPDATE pedidos SET estado='entregado', entregado_en=now() WHERE id = ANY($1::int[]) AND estado='en_ruta'`, [llegaron]);
    await query(
      `INSERT INTO pedido_eventos (pedido_id, estado, nota) SELECT unnest($1::int[]), 'entregado', 'Entrega confirmada por el conductor'`, [llegaron]
    );
    resumen.entregados = llegaron.length;
  }

  // 2) Pedidos asignados salen del centro de distribución.
  const porSalir = await query<{ id: number }>(
    `SELECT p.id FROM pedidos p JOIN vehiculos v ON v.id = p.vehiculo_id
     WHERE p.estado = 'asignado' AND v.estado = 'activo' AND random() < 0.4`
  );
  if (porSalir.length) {
    const ids = porSalir.map((x) => x.id);
    await query(`UPDATE pedidos SET estado='en_ruta', salida_en=now() WHERE id = ANY($1::int[])`, [ids]);
    await query(
      `INSERT INTO pedido_eventos (pedido_id, estado, nota)
       SELECT p.id, 'en_ruta', 'El vehículo salió del ' || c.nombre FROM pedidos p JOIN centros c ON c.id = p.centro_id WHERE p.id = ANY($1::int[])`, [ids]
    );
    await query(
      `UPDATE vehiculos SET velocidad_kmh = 40, ultima_senal = now() WHERE id IN (SELECT vehiculo_id FROM pedidos WHERE id = ANY($1::int[]))`, [ids]
    );
    resumen.salidas = ids.length;
  }

  // 3) Entran pedidos nuevos (si la operación no está saturada).
  const carga = await queryOne<{ n: number }>(`SELECT count(*) AS n FROM pedidos WHERE estado IN ('pendiente','asignado','en_ruta')`);
  if ((carga?.n ?? 0) < 85 && Math.random() < 0.45) {
    const centros = await query<{ id: number; ciudad: string }>(`SELECT id, ciudad FROM centros`);
    const clientes = await query<{ id: number }>(`SELECT id FROM clientes ORDER BY random() LIMIT 1`);
    const centro = pick(centros);
    const destinos = CIUDADES.filter((c) => c.ciudad !== centro.ciudad);
    if (clientes[0] && centros.length) {
      const p = await crearPedido({
        cliente_id: clientes[0].id, centro_id: centro.id, destino_ciudad: pick(destinos).ciudad,
        destino_direccion: `Carrera ${Math.ceil(entre(1, 60))} # ${Math.ceil(entre(1, 50))}-${Math.ceil(entre(1, 99))}`,
        peso_kg: Math.round(entre(150, 5500)),
      });
      resumen.pedidosNuevos++;
      void p;
    }
  }

  // 4) Asigna los pendientes (los más antiguos primero).
  const pendientes = await query<{ id: number }>(`SELECT id FROM pedidos WHERE estado='pendiente' ORDER BY creado_en LIMIT 4`);
  for (const p of pendientes) {
    const r = await asignarPedido(p.id);
    if (r.ok) resumen.asignados++;
  }

  // 5) De vez en cuando: una carga de combustible, y limpieza del historial GPS.
  if (Math.random() < 0.25) {
    await query(
      `INSERT INTO cargas_combustible (vehiculo_id, conductor_id, galones, costo_cop)
       SELECT id, conductor_id, g, round(g * 10150 / 10) * 10 FROM (
         SELECT id, conductor_id, round((10 + random() * 40)::numeric, 2) AS g FROM vehiculos WHERE estado = 'activo' ORDER BY random() LIMIT 1
       ) x`
    );
  }
  if (Math.random() < 0.03) await query(`DELETE FROM eventos_gps WHERE creado_en < now() - interval '3 days'`);

  return resumen;
}
