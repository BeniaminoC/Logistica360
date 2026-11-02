// Datos de demostración: 5 centros, 100 vehículos, 100 conductores, ~400 pedidos, combustible,
// mantenimiento e incidentes de las últimas dos semanas.
// Uso: npm run db:seed        (si ya hay datos, pide --force)
//      npm run db:seed -- --force   (borra todo y vuelve a crear)
import { createClient } from "./db-config.mjs";

// ---------- utilidades ----------
let s = 20261031; // semilla fija: los datos de demo son reproducibles
const rand = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const U = (a, b) => a + rand() * (b - a);
const Ui = (a, b) => Math.floor(U(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const H = 3600 * 1000, MIN = 60 * 1000, DAY = 24 * H;

function haversine(a, b, c, d) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(c - a), dLng = rad(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const roadKm = (a, b, c, d) => Math.max(5, Math.round(haversine(a, b, c, d) * 1.3));

async function insertMany(client, table, cols, rows) {
  if (!rows.length) return;
  const per = Math.floor(60000 / cols.length);
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const params = [];
    const tuples = chunk.map((r, ri) => {
      const ph = cols.map((_, ci) => `$${ri * cols.length + ci + 1}`);
      params.push(...r);
      return `(${ph.join(",")})`;
    });
    await client.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${tuples.join(",")}`, params);
  }
}

// ---------- catálogos ----------
const CENTROS = [
  { id: 1, nombre: "CD Montería", ciudad: "Montería", lat: 8.7479, lng: -75.8814, flota: 30 },
  { id: 2, nombre: "CD Cartagena", ciudad: "Cartagena", lat: 10.391, lng: -75.4794, flota: 25 },
  { id: 3, nombre: "CD Barranquilla", ciudad: "Barranquilla", lat: 10.9685, lng: -74.7813, flota: 20 },
  { id: 4, nombre: "CD Medellín", ciudad: "Medellín", lat: 6.2442, lng: -75.5812, flota: 15 },
  { id: 5, nombre: "CD Sincelejo", ciudad: "Sincelejo", lat: 9.3047, lng: -75.3978, flota: 10 },
];

const DESTINOS = [
  ["Montería", 8.7479, -75.8814], ["Lorica", 9.2394, -75.8138], ["Sahagún", 8.9469, -75.4439],
  ["Cereté", 8.8853, -75.7922], ["Planeta Rica", 8.4101, -75.5848], ["Montelíbano", 7.9769, -75.4181],
  ["Tierralta", 8.1717, -76.0595], ["Sincelejo", 9.3047, -75.3978], ["Corozal", 9.3175, -75.2935],
  ["Magangué", 9.2417, -74.7544], ["Cartagena", 10.391, -75.4794], ["Turbaco", 10.3333, -75.4167],
  ["Barranquilla", 10.9685, -74.7813], ["Soledad", 10.9184, -74.7646], ["Santa Marta", 11.2408, -74.199],
  ["Valledupar", 10.4631, -73.2532], ["Medellín", 6.2442, -75.5812], ["Envigado", 6.1759, -75.5917],
  ["Bello", 6.3373, -75.5579], ["Caucasia", 7.9845, -75.1942], ["Apartadó", 7.883, -76.6259],
];
const CALLES = ["Calle", "Carrera", "Avenida", "Transversal", "Diagonal"];
const BARRIOS = ["Zona Industrial", "Centro", "El Prado", "La Castellana", "Villa Nueva", "Las Palmas", "San Fernando", "Bosques del Norte"];

const NOMBRES = ["Andrés", "Camilo", "Luis", "Carlos", "Jhon", "Wilmer", "Yeison", "Hernán", "Óscar", "Fabián", "Rafael", "Edwin", "Jorge", "Mauricio", "Alexánder", "Darío", "Iván", "Nelson", "Ricardo", "Sergio", "Pedro", "Juan", "Víctor", "Álvaro", "Cristian", "Eduardo", "Gustavo", "Héctor", "Julio", "Manuel"];
const APELLIDOS = ["Pérez", "Gómez", "Rodríguez", "Martínez", "López", "Hernández", "Díaz", "Vargas", "Castro", "Ortega", "Ríos", "Mendoza", "Pacheco", "Doria", "Causil", "Hoyos", "Álvarez", "Suárez", "Montes", "Támara", "Ballesteros", "Negrete", "Arrieta", "Villadiego", "Sierra", "Navarro", "Salcedo", "Berrío", "Padilla", "Jiménez"];
const EMP_A = ["Supermercados", "Distribuidora", "Ferretería", "Droguería", "Almacenes", "Agroinsumos", "Comercial", "Bebidas", "Lácteos", "Electro"];
const EMP_B = ["La Sabana", "El Caribe", "Del Sinú", "Costa Norte", "Central", "San Jorge", "Mar y Sol", "Los Andes", "Río Grande", "Santa Cruz", "Nuevo Día", "La Palma", "Unión", "Bahía", "El Roble"];

const TIPOS = [
  { tipo: "Furgón", cap: 1500, w: 0.35 },
  { tipo: "Turbo", cap: 4500, w: 0.3 },
  { tipo: "Camión sencillo", cap: 8000, w: 0.25 },
  { tipo: "Tractocamión", cap: 28000, w: 0.1 },
];
function tipoAleatorio() {
  let r = rand();
  for (const t of TIPOS) { if ((r -= t.w) < 0) return t; }
  return TIPOS[0];
}

// ---------- generación ----------
const now = Date.now();
const ts = (ms) => new Date(ms).toISOString();

const centros = CENTROS.map(({ flota, ...c }) => c);

// Conductores y clientes
const conductores = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  nombre: `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`,
  telefono: `3${Ui(0, 2)}${Ui(0, 9)} ${Ui(100, 999)} ${Ui(1000, 9999)}`,
  licencia: `C${Ui(1, 3)}-${Ui(10000000, 99999999)}`,
}));
const clientes = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  nombre: `${pick(EMP_A)} ${pick(EMP_B)}`,
  email: `compras${i + 1}@cliente-demo.co`,
  telefono: `60${Ui(4, 5)} ${Ui(200, 999)} ${Ui(1000, 9999)}`,
}));

// Vehículos
const placas = new Set();
const nuevaPlaca = () => {
  let p;
  do {
    p = Array.from({ length: 3 }, () => String.fromCharCode(65 + Ui(0, 25))).join("") + Ui(100, 999);
  } while (placas.has(p));
  placas.add(p);
  return p;
};
const vehiculos = [];
for (const c of CENTROS) {
  for (let k = 0; k < c.flota; k++) {
    const t = tipoAleatorio();
    const km = Ui(40000, 420000);
    const sinceService = rand() < 0.1 ? Ui(9000, 11500) : Ui(500, 8500);
    vehiculos.push({
      id: vehiculos.length + 1, placa: nuevaPlaca(), tipo: t.tipo, cap: t.cap, estado: "activo",
      centro: c, conductor_id: vehiculos.length + 1,
      km_total: km, km_mant: km - sinceService,
      lat: c.lat + U(-0.02, 0.02), lng: c.lng + U(-0.02, 0.02), vel: 0,
      senal: now - Ui(1, 40) * 1000, pedido: null,
    });
  }
}
const orden = shuffle([...vehiculos]);
orden.slice(0, 8).forEach((v) => { v.estado = "mantenimiento"; v.senal = now - Ui(1, 6) * H; });
orden.slice(8, 15).forEach((v) => { v.estado = "inactivo"; v.senal = now - Ui(1, 3) * DAY; });
const activos = () => shuffle(vehiculos.filter((v) => v.estado === "activo" && !v.pedido));

// Pedidos
const pedidos = [];
const eventos = [];
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const codigos = new Set();
function nuevoCodigo() {
  let c;
  do { c = "L360-" + Array.from({ length: 6 }, () => ALFABETO[Math.floor(rand() * ALFABETO.length)]).join(""); } while (codigos.has(c));
  codigos.add(c);
  return c;
}
function nuevoPedido({ centro, estado, vehiculo, creado }) {
  const cl = pick(clientes);
  let dest;
  do { dest = pick(DESTINOS); } while (dest[0] === centro.ciudad);
  const [ciudad, dlat, dlng] = dest;
  const dist = roadKm(centro.lat, centro.lng, dlat, dlng);
  const peso = vehiculo ? Ui(120, Math.min(Math.floor(vehiculo.cap * 0.9), 9000)) : Ui(120, 6000);
  const p = {
    id: pedidos.length + 1, codigo: nuevoCodigo(), cliente_id: cl.id, centro_id: centro.id,
    destino_direccion: `${pick(CALLES)} ${Ui(1, 80)} # ${Ui(1, 60)}-${Ui(1, 99)}, ${pick(BARRIOS)}`,
    destino_ciudad: ciudad, dlat: dlat + U(-0.01, 0.01), dlng: dlng + U(-0.01, 0.01),
    peso, dist, estado, veh: vehiculo ?? null, creado,
    asignado: null, salida: null, entregado: null, prometido: null,
  };
  pedidos.push(p);
  return p;
}
const ev = (p, estado, nota, cuando) => eventos.push([p.id, estado, nota, ts(cuando)]);

// 1) En ruta (45): posición intermedia entre el centro y el destino
const enRuta = [];
for (const v of activos().slice(0, 45)) {
  const prog = U(0.08, 0.92);
  const p = nuevoPedido({ centro: v.centro, estado: "en_ruta", vehiculo: v, creado: 0 });
  const horasViaje = p.dist / 55;
  p.salida = now - prog * horasViaje * H;
  p.asignado = p.salida - Ui(10, 40) * MIN;
  p.creado = p.asignado - Ui(5, 50) * MIN;
  p.prometido = p.salida + (p.dist / 45 + 1) * H;
  v.pedido = p;
  v.lat = v.centro.lat + (p.dlat - v.centro.lat) * prog;
  v.lng = v.centro.lng + (p.dlng - v.centro.lng) * prog;
  v.vel = Ui(48, 78);
  enRuta.push(v);
}
// 6 retrasados y 4 sin señal
shuffle([...enRuta]).slice(0, 6).forEach((v) => { v.pedido.prometido = now - Ui(10, 95) * MIN; });
shuffle([...enRuta]).slice(0, 4).forEach((v) => { v.senal = now - Ui(25, 70) * MIN; v.vel = 0; });

// 2) Asignados (14): esperando salida en su centro
for (const v of activos().slice(0, 14)) {
  const p = nuevoPedido({ centro: v.centro, estado: "asignado", vehiculo: v, creado: 0 });
  p.asignado = now - Ui(3, 40) * MIN;
  p.creado = p.asignado - Ui(5, 60) * MIN;
  p.prometido = p.asignado + (p.dist / 45 + 2) * H;
  v.pedido = p;
}
// 3) Pendientes (12)
for (let i = 0; i < 12; i++) {
  const p = nuevoPedido({ centro: pick(CENTROS), estado: "pendiente", vehiculo: null, creado: now - Ui(2, 90) * MIN });
  p.prometido = p.creado + (p.dist / 45 + 4) * H;
}
// 4) Entregados (histórico de 14 días + hoy)
let intentos = 0;
while (pedidos.filter((p) => p.estado === "entregado").length < 320 && intentos++ < 5000) {
  const v = pick(vehiculos.filter((x) => x.estado !== "inactivo"));
  const reciente = rand() < 0.2;
  const creado = reciente ? now - U(3, 14) * H : now - U(1, 14) * DAY;
  const p = nuevoPedido({ centro: v.centro, estado: "entregado", vehiculo: v, creado });
  p.asignado = p.creado + Ui(8, 60) * MIN;
  p.salida = p.asignado + Ui(15, 90) * MIN;
  p.prometido = p.salida + (p.dist / 45 + 1) * H;
  const total = p.prometido - p.salida;
  p.entregado = rand() < 0.14 ? p.prometido + U(0.3, 2.5) * H : p.salida + total * U(0.55, 0.97);
  if (p.entregado > now - 5 * MIN) { codigos.delete(pedidos.pop().codigo); }
}

// Eventos de línea de tiempo
for (const p of pedidos) {
  ev(p, "pendiente", "Pedido recibido", p.creado);
  const v = p.veh;
  if (p.asignado) ev(p, "asignado", `Vehículo ${v.placa} asignado a tu pedido`, p.asignado);
  if (p.salida) ev(p, "en_ruta", `El vehículo salió del ${CENTROS.find((c) => c.id === p.centro_id).nombre}`, p.salida);
  if (p.entregado) ev(p, "entregado", "Entrega confirmada por el conductor", p.entregado);
}

// Combustible (14 días)
const combustible = [];
for (const v of vehiculos.filter((x) => x.estado !== "inactivo")) {
  const n = Ui(3, 7);
  for (let i = 0; i < n; i++) {
    const cuando = now - U(0.1, 14) * DAY;
    const gal = v.tipo === "Tractocamión" ? U(45, 95) : v.tipo === "Camión sencillo" ? U(28, 60) : U(12, 38);
    const precio = 10100 + Math.round(Math.sin(cuando / DAY) * 220) + Ui(-40, 40);
    combustible.push([v.id, null, v.conductor_id, gal.toFixed(2), Math.round((gal * precio) / 10) * 10, ts(cuando)]);
  }
}

// Mantenimiento
const mantenimiento = [];
const DESC_PREV = ["Cambio de aceite y filtros", "Revisión de frenos", "Alineación y balanceo", "Cambio de llantas", "Revisión de suspensión"];
const DESC_CORR = ["Falla en sistema de refrigeración", "Reparación de embrague", "Cambio de alternador", "Falla eléctrica en luces", "Reparación de caja de cambios"];
for (const v of vehiculos.filter((x) => x.estado === "mantenimiento")) {
  const prev = rand() < 0.5;
  mantenimiento.push([v.id, prev ? "preventivo" : "correctivo", "abierta", pick(prev ? DESC_PREV : DESC_CORR), 0, ts(v.senal), null]);
}
for (let i = 0; i < 26; i++) {
  const v = pick(vehiculos);
  const prev = rand() < 0.65;
  const creada = now - U(0.5, 14) * DAY;
  mantenimiento.push([v.id, prev ? "preventivo" : "correctivo", "cerrada", pick(prev ? DESC_PREV : DESC_CORR),
    Math.round((prev ? U(150000, 900000) : U(600000, 2600000)) / 1000) * 1000, ts(creada), ts(creada + U(4, 40) * H)]);
}

// Incidentes
const incidentes = [];
const TIPOS_INC = [["accidente", "Colisión leve sin heridos"], ["falla_mecanica", "Vehículo detenido en vía por falla"], ["desvio", "Desvío por cierre de vía"], ["robo", "Intento de hurto de mercancía"], ["otro", "Retén prolongado en carretera"]];
for (let i = 0; i < 9; i++) {
  const v = pick(vehiculos);
  const [tipo, desc] = pick(TIPOS_INC);
  incidentes.push([v.id, v.conductor_id, tipo, desc, v.lat, v.lng, ts(now - (i < 2 ? U(0.5, 20) * H : U(1, 14) * DAY))]);
}

// ---------- escritura ----------
const client = createClient();
await client.connect();
try {
  const force = process.argv.includes("--force");
  const { rows } = await client.query("SELECT to_regclass('public.pedidos') AS t");
  if (!rows[0].t) throw new Error("No existen las tablas. Ejecuta primero: npm run db:migrate");
  const { rows: cnt } = await client.query("SELECT count(*)::int AS n FROM pedidos");
  if (cnt[0].n > 0 && !force) {
    console.log("La base ya tiene datos. Usa `npm run db:seed -- --force` para borrarlos y recrearlos.");
    process.exit(0);
  }
  await client.query("BEGIN");
  await client.query(`TRUNCATE incidentes, ordenes_mantenimiento, cargas_combustible, eventos_gps, pedido_eventos,
    pedidos, clientes, vehiculos, conductores, centros RESTART IDENTITY CASCADE`);

  await insertMany(client, "centros", ["id", "nombre", "ciudad", "lat", "lng"], centros.map((c) => [c.id, c.nombre, c.ciudad, c.lat, c.lng]));
  await insertMany(client, "conductores", ["id", "nombre", "telefono", "licencia"], conductores.map((c) => [c.id, c.nombre, c.telefono, c.licencia]));
  await insertMany(client, "clientes", ["id", "nombre", "email", "telefono"], clientes.map((c) => [c.id, c.nombre, c.email, c.telefono]));
  await insertMany(client, "vehiculos",
    ["id", "placa", "tipo", "capacidad_kg", "estado", "centro_id", "conductor_id", "km_total", "km_ultimo_mantenimiento", "lat", "lng", "velocidad_kmh", "ultima_senal"],
    vehiculos.map((v) => [v.id, v.placa, v.tipo, v.cap, v.estado, v.centro.id, v.conductor_id, v.km_total, v.km_mant, v.lat, v.lng, v.vel, ts(v.senal)]));
  await insertMany(client, "pedidos",
    ["id", "codigo", "cliente_id", "centro_id", "destino_direccion", "destino_ciudad", "destino_lat", "destino_lng", "peso_kg", "distancia_km",
      "estado", "vehiculo_id", "conductor_id", "creado_en", "asignado_en", "salida_en", "entregado_en", "prometido_en"],
    pedidos.map((p) => [p.id, p.codigo, p.cliente_id, p.centro_id, p.destino_direccion, p.destino_ciudad, p.dlat, p.dlng, p.peso, p.dist,
      p.estado, p.veh?.id ?? null, p.veh?.conductor_id ?? null, ts(p.creado),
      p.asignado ? ts(p.asignado) : null, p.salida ? ts(p.salida) : null, p.entregado ? ts(p.entregado) : null, ts(p.prometido)]));
  await insertMany(client, "pedido_eventos", ["pedido_id", "estado", "nota", "creado_en"], eventos);
  await insertMany(client, "eventos_gps", ["vehiculo_id", "lat", "lng", "velocidad_kmh", "creado_en"],
    vehiculos.map((v) => [v.id, v.lat, v.lng, v.vel, ts(v.senal)]));
  await insertMany(client, "cargas_combustible", ["vehiculo_id", "pedido_id", "conductor_id", "galones", "costo_cop", "creado_en"], combustible);
  await insertMany(client, "ordenes_mantenimiento", ["vehiculo_id", "tipo", "estado", "descripcion", "costo_cop", "creada_en", "cerrada_en"], mantenimiento);
  await insertMany(client, "incidentes", ["vehiculo_id", "conductor_id", "tipo", "descripcion", "lat", "lng", "creado_en"], incidentes);

  for (const t of ["centros", "conductores", "clientes", "vehiculos", "pedidos"]) {
    await client.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT max(id) FROM ${t}))`);
  }
  await client.query("COMMIT");

  const por = (e) => pedidos.filter((p) => p.estado === e).length;
  console.log(`✔ Datos de demostración creados:
  ${centros.length} centros · ${vehiculos.length} vehículos · ${conductores.length} conductores · ${clientes.length} clientes
  pedidos: ${por("pendiente")} pendientes · ${por("asignado")} asignados · ${por("en_ruta")} en ruta · ${por("entregado")} entregados
  ${combustible.length} cargas de combustible · ${mantenimiento.length} órdenes de mantenimiento · ${incidentes.length} incidentes`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("✘ Error en el seed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
