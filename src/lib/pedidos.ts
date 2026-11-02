import { randomBytes } from "node:crypto";
import { query, queryOne, transaccion } from "./db";
import { CIUDADES } from "./ciudades";
import { distanciaCarreteraKm, haversineKm } from "./geo";
import type { EstadoPedido } from "./types";

export type PedidoFila = {
  id: number; codigo: string; estado: EstadoPedido; cliente: string; centro: string; destino_ciudad: string;
  destino_direccion: string; peso_kg: number; distancia_km: number; placa: string | null; conductor: string | null;
  creado_en: string; prometido_en: string; entregado_en: string | null; retrasado: boolean;
};

export async function listarPedidos(opts: { estado?: string; q?: string; limite?: number } = {}): Promise<PedidoFila[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.estado && opts.estado !== "todos") {
    params.push(opts.estado);
    where.push(`p.estado = $${params.length}`);
  }
  if (opts.q?.trim()) {
    params.push(`%${opts.q.trim()}%`);
    where.push(`(p.codigo ILIKE $${params.length} OR cl.nombre ILIKE $${params.length} OR p.destino_ciudad ILIKE $${params.length} OR v.placa ILIKE $${params.length})`);
  }
  params.push(Math.min(opts.limite ?? 100, 500));
  return query<PedidoFila>(
    `SELECT p.id, p.codigo, p.estado, cl.nombre AS cliente, ce.nombre AS centro, p.destino_ciudad, p.destino_direccion,
            p.peso_kg, p.distancia_km, v.placa, co.nombre AS conductor, p.creado_en, p.prometido_en, p.entregado_en,
            (p.estado IN ('pendiente','asignado','en_ruta') AND p.prometido_en < now())
              OR (p.estado = 'entregado' AND p.entregado_en > p.prometido_en) AS retrasado
     FROM pedidos p
     JOIN clientes cl ON cl.id = p.cliente_id
     JOIN centros ce ON ce.id = p.centro_id
     LEFT JOIN vehiculos v ON v.id = p.vehiculo_id
     LEFT JOIN conductores co ON co.id = p.conductor_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY CASE p.estado WHEN 'pendiente' THEN 0 WHEN 'asignado' THEN 1 WHEN 'en_ruta' THEN 2 ELSE 3 END, p.creado_en DESC
     LIMIT $${params.length}`,
    params
  );
}

export async function conteoPorEstado(): Promise<Record<string, number>> {
  const rows = await query<{ estado: string; n: number }>(`SELECT estado, count(*) AS n FROM pedidos GROUP BY estado`);
  return Object.fromEntries(rows.map((r) => [r.estado, r.n]));
}

export type NuevoPedido = {
  cliente_id?: number;
  cliente_nombre?: string;
  centro_id: number;
  destino_ciudad: string;
  destino_direccion: string;
  peso_kg: number;
};

export class ErrorDeNegocio extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin caracteres que se confunden (0/O, 1/I/L)

/** Código de seguimiento no secuencial: que no se pueda adivinar el de otro cliente cambiando un dígito. */
function codigoAleatorio() {
  const bytes = randomBytes(6);
  return "L360-" + Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export async function crearPedido(input: NuevoPedido): Promise<{ id: number; codigo: string }> {
  const ciudad = CIUDADES.find((c) => c.ciudad === input.destino_ciudad);
  if (!ciudad) throw new ErrorDeNegocio("La ciudad de destino no está en el catálogo.");
  if (!Number.isFinite(input.peso_kg) || input.peso_kg <= 0 || input.peso_kg > 30000) {
    throw new ErrorDeNegocio("El peso debe estar entre 1 y 30.000 kg.");
  }
  if (!input.destino_direccion?.trim()) throw new ErrorDeNegocio("Escribe la dirección de entrega.");

  return transaccion(async (q) => {
    const [centro] = await q<{ id: number; lat: number; lng: number }>(`SELECT id, lat, lng FROM centros WHERE id = $1`, [input.centro_id]);
    if (!centro) throw new ErrorDeNegocio("El centro de distribución no existe.");

    let clienteId = input.cliente_id;
    if (!clienteId) {
      const nombre = input.cliente_nombre?.trim();
      if (!nombre) throw new ErrorDeNegocio("Indica el cliente.");
      const [existente] = await q<{ id: number }>(`SELECT id FROM clientes WHERE lower(nombre) = lower($1) LIMIT 1`, [nombre]);
      clienteId = existente?.id ?? (await q<{ id: number }>(`INSERT INTO clientes (nombre) VALUES ($1) RETURNING id`, [nombre]))[0].id;
    }

    const dist = distanciaCarreteraKm(centro.lat, centro.lng, ciudad.lat, ciudad.lng);
    const horasPrometidas = dist / 45 + 4; // viaje a 45 km/h promedio + 4 h de preparación y asignación
    let p: { id: number; codigo: string } | undefined;
    for (let intento = 0; intento < 5 && !p; intento++) {
      const codigo = codigoAleatorio();
      [p] = await q<{ id: number; codigo: string }>(
        `INSERT INTO pedidos (codigo, cliente_id, centro_id, destino_direccion, destino_ciudad, destino_lat, destino_lng, peso_kg, distancia_km, prometido_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + make_interval(secs => $10))
         ON CONFLICT (codigo) DO NOTHING RETURNING id, codigo`,
        [codigo, clienteId, centro.id, input.destino_direccion.trim(), ciudad.ciudad, ciudad.lat, ciudad.lng, Math.round(input.peso_kg), dist, horasPrometidas * 3600]
      );
    }
    if (!p) throw new Error("No se pudo generar un código de pedido único.");
    await q(`INSERT INTO pedido_eventos (pedido_id, estado, nota) VALUES ($1, 'pendiente', 'Pedido recibido')`, [p.id]);
    return { id: p.id, codigo: p.codigo };
  });
}

export type ResultadoAsignacion =
  | { ok: true; vehiculo: string; conductor: string | null; distanciaAlCentroKm: number }
  | { ok: false; motivo: string };

/**
 * Asigna el vehículo disponible más conveniente: activo, con la capacidad necesaria, sin pedido en curso,
 * con señal reciente y lo más cerca posible del centro de origen. A igual cercanía prefiere el de capacidad más ajustada.
 */
export async function asignarPedido(pedidoId: number): Promise<ResultadoAsignacion> {
  return transaccion(async (q) => {
    await q(`SELECT pg_advisory_xact_lock(360)`); // serializa asignaciones: evita dar el mismo vehículo a dos pedidos
    const [p] = await q<{ id: number; estado: string; peso_kg: number; lat: number; lng: number; codigo: string }>(
      `SELECT p.id, p.estado, p.peso_kg, c.lat, c.lng, p.codigo FROM pedidos p JOIN centros c ON c.id = p.centro_id WHERE p.id = $1 FOR UPDATE OF p`,
      [pedidoId]
    );
    if (!p) throw new ErrorDeNegocio("El pedido no existe.", 404);
    if (p.estado !== "pendiente") return { ok: false as const, motivo: "El pedido ya tiene vehículo o fue cerrado." };

    const candidatos = await q<{ id: number; placa: string; capacidad_kg: number; lat: number; lng: number; conductor_id: number | null; conductor: string | null }>(
      `SELECT v.id, v.placa, v.capacidad_kg, v.lat, v.lng, v.conductor_id, c.nombre AS conductor
       FROM vehiculos v LEFT JOIN conductores c ON c.id = v.conductor_id
       WHERE v.estado = 'activo' AND v.capacidad_kg >= $1 AND v.lat IS NOT NULL
         AND v.conductor_id IS NOT NULL AND c.activo
         AND v.ultima_senal > now() - interval '15 minutes'
         AND NOT EXISTS (SELECT 1 FROM pedidos x WHERE x.vehiculo_id = v.id AND x.estado IN ('asignado','en_ruta'))`,
      [p.peso_kg]
    );
    if (!candidatos.length) {
      return { ok: false as const, motivo: "No hay un vehículo libre con la capacidad necesaria. El pedido queda pendiente." };
    }
    const puntuado = candidatos
      .map((v) => ({ v, km: haversineKm(v.lat, v.lng, p.lat, p.lng) }))
      .map((x) => ({ ...x, score: x.km + (x.v.capacidad_kg - p.peso_kg) / 500 }))
      .sort((a, b) => a.score - b.score)[0];

    await q(
      `UPDATE pedidos SET estado='asignado', vehiculo_id=$1, conductor_id=$2, asignado_en=now() WHERE id=$3`,
      [puntuado.v.id, puntuado.v.conductor_id, pedidoId]
    );
    await q(`INSERT INTO pedido_eventos (pedido_id, estado, nota) VALUES ($1,'asignado',$2)`, [
      pedidoId, `Vehículo ${puntuado.v.placa} asignado a tu pedido`,
    ]);
    return { ok: true as const, vehiculo: puntuado.v.placa, conductor: puntuado.v.conductor, distanciaAlCentroKm: Math.round(puntuado.km) };
  });
}

const TRANSICIONES: Record<string, EstadoPedido[]> = {
  pendiente: ["cancelado"],
  asignado: ["en_ruta", "cancelado"],
  en_ruta: ["entregado"],
};

export async function cambiarEstado(pedidoId: number, nuevo: EstadoPedido, nota?: string) {
  return transaccion(async (q) => {
    const [p] = await q<{ estado: string; vehiculo_id: number | null }>(`SELECT estado, vehiculo_id FROM pedidos WHERE id=$1 FOR UPDATE`, [pedidoId]);
    if (!p) throw new ErrorDeNegocio("El pedido no existe.", 404);
    if (!TRANSICIONES[p.estado]?.includes(nuevo)) {
      throw new ErrorDeNegocio(`No se puede pasar un pedido de "${p.estado}" a "${nuevo}".`, 409);
    }
    const col = nuevo === "en_ruta" ? ", salida_en = now()" : nuevo === "entregado" ? ", entregado_en = now()" : "";
    await q(`UPDATE pedidos SET estado = $1${col} WHERE id = $2`, [nuevo, pedidoId]);
    const texto =
      nota ??
      (nuevo === "en_ruta" ? "El vehículo salió hacia tu dirección"
        : nuevo === "entregado" ? "Entrega confirmada por el conductor"
        : "Pedido cancelado");
    await q(`INSERT INTO pedido_eventos (pedido_id, estado, nota) VALUES ($1,$2,$3)`, [pedidoId, nuevo, texto]);
    return { estado: nuevo };
  });
}

export type Seguimiento = {
  codigo: string; estado: EstadoPedido; destino_ciudad: string; peso_kg: number;
  prometido_en: string; entregado_en: string | null; retrasado: boolean;
  origen: { nombre: string; lat: number; lng: number };
  destino: { lat: number; lng: number };
  vehiculo: { placa: string; tipo: string; lat: number; lng: number; velocidad_kmh: number; ultima_senal: string | null } | null;
  conductor: string | null;
  restanteKm: number | null;
  eventos: { estado: string; nota: string | null; creado_en: string }[];
};

/** Vista pública para quien tiene el código: sin nombre del cliente ni dirección exacta, y con solo el nombre de pila del conductor. */
export async function obtenerSeguimiento(codigo: string): Promise<Seguimiento | null> {
  const p = await queryOne<{
    id: number; codigo: string; estado: EstadoPedido; cliente: string; destino_ciudad: string; destino_direccion: string; peso_kg: number;
    prometido_en: string; entregado_en: string | null; destino_lat: number; destino_lng: number;
    centro: string; centro_lat: number; centro_lng: number;
    placa: string | null; tipo: string | null; vlat: number | null; vlng: number | null; vel: number | null; senal: string | null; conductor: string | null;
  }>(
    `SELECT p.id, p.codigo, p.estado, cl.nombre AS cliente, p.destino_ciudad, p.destino_direccion, p.peso_kg, p.prometido_en, p.entregado_en,
            p.destino_lat, p.destino_lng, ce.nombre AS centro, ce.lat AS centro_lat, ce.lng AS centro_lng,
            v.placa, v.tipo, v.lat AS vlat, v.lng AS vlng, v.velocidad_kmh AS vel, v.ultima_senal AS senal, co.nombre AS conductor
     FROM pedidos p
     JOIN clientes cl ON cl.id = p.cliente_id
     JOIN centros ce ON ce.id = p.centro_id
     LEFT JOIN vehiculos v ON v.id = p.vehiculo_id
     LEFT JOIN conductores co ON co.id = p.conductor_id
     WHERE upper(p.codigo) = upper($1)`,
    [codigo.trim()]
  );
  if (!p) return null;
  const eventos = await query<{ estado: string; nota: string | null; creado_en: string }>(
    `SELECT estado, nota, creado_en FROM pedido_eventos WHERE pedido_id = $1 ORDER BY creado_en, id`, [p.id]
  );
  const enCurso = p.estado === "asignado" || p.estado === "en_ruta";
  const retrasado = p.estado === "entregado" ? new Date(p.entregado_en!) > new Date(p.prometido_en)
    : enCurso || p.estado === "pendiente" ? new Date(p.prometido_en) < new Date() : false;
  return {
    codigo: p.codigo, estado: p.estado, destino_ciudad: p.destino_ciudad,
    peso_kg: p.peso_kg, prometido_en: p.prometido_en, entregado_en: p.entregado_en, retrasado,
    origen: { nombre: p.centro, lat: p.centro_lat, lng: p.centro_lng },
    destino: { lat: p.destino_lat, lng: p.destino_lng },
    vehiculo: p.placa && p.vlat != null && p.vlng != null && enCurso
      ? { placa: p.placa, tipo: p.tipo ?? "", lat: p.vlat, lng: p.vlng, velocidad_kmh: p.vel ?? 0, ultima_senal: p.senal }
      : null,
    conductor: p.conductor ? p.conductor.split(" ")[0] : null, // al cliente solo se le muestra el nombre de pila
    restanteKm: p.vlat != null && p.vlng != null && p.estado === "en_ruta"
      ? Math.round(haversineKm(p.vlat, p.vlng, p.destino_lat, p.destino_lng) * 1.2) : null,
    eventos,
  };
}

export async function listarCentros() {
  return query<{ id: number; nombre: string; ciudad: string }>(`SELECT id, nombre, ciudad FROM centros ORDER BY id`);
}

export async function listarClientes() {
  return query<{ id: number; nombre: string }>(`SELECT id, nombre FROM clientes ORDER BY nombre`);
}
