-- Logística360 · esquema PostgreSQL (compatible con Aiven for PostgreSQL)
-- Es idempotente: se puede ejecutar varias veces con `npm run db:migrate`.

CREATE TABLE IF NOT EXISTS centros (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  ciudad    TEXT NOT NULL,
  lat       DOUBLE PRECISION NOT NULL,
  lng       DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS conductores (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  telefono  TEXT,
  licencia  TEXT,
  activo    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id                     SERIAL PRIMARY KEY,
  placa                  TEXT NOT NULL UNIQUE,
  tipo                   TEXT NOT NULL,
  capacidad_kg           INTEGER NOT NULL,
  estado                 TEXT NOT NULL DEFAULT 'activo'
                         CHECK (estado IN ('activo', 'inactivo', 'mantenimiento')),
  centro_id              INTEGER REFERENCES centros(id),
  conductor_id           INTEGER REFERENCES conductores(id),
  km_total               INTEGER NOT NULL DEFAULT 0,
  km_ultimo_mantenimiento INTEGER NOT NULL DEFAULT 0,
  lat                    DOUBLE PRECISION,
  lng                    DOUBLE PRECISION,
  velocidad_kmh          INTEGER NOT NULL DEFAULT 0,
  ultima_senal           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clientes (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  email     TEXT,
  telefono  TEXT
);

CREATE TABLE IF NOT EXISTS pedidos (
  id               SERIAL PRIMARY KEY,
  codigo           TEXT NOT NULL UNIQUE,
  cliente_id       INTEGER NOT NULL REFERENCES clientes(id),
  centro_id        INTEGER NOT NULL REFERENCES centros(id),
  destino_direccion TEXT NOT NULL,
  destino_ciudad   TEXT NOT NULL,
  destino_lat      DOUBLE PRECISION NOT NULL,
  destino_lng      DOUBLE PRECISION NOT NULL,
  peso_kg          INTEGER NOT NULL CHECK (peso_kg > 0),
  distancia_km     INTEGER NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente', 'asignado', 'en_ruta', 'entregado', 'cancelado')),
  vehiculo_id      INTEGER REFERENCES vehiculos(id),
  conductor_id     INTEGER REFERENCES conductores(id),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  asignado_en      TIMESTAMPTZ,
  salida_en        TIMESTAMPTZ,
  entregado_en     TIMESTAMPTZ,
  prometido_en     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_vehiculo ON pedidos(vehiculo_id) WHERE estado IN ('asignado', 'en_ruta');
CREATE INDEX IF NOT EXISTS idx_pedidos_creado ON pedidos(creado_en DESC);

-- Línea de tiempo que ve el cliente en el seguimiento
CREATE TABLE IF NOT EXISTS pedido_eventos (
  id         BIGSERIAL PRIMARY KEY,
  pedido_id  INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  estado     TEXT NOT NULL,
  nota       TEXT,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedido_eventos_pedido ON pedido_eventos(pedido_id, creado_en);

-- Historial de posiciones GPS (se conservan las últimas lecturas por vehículo)
CREATE TABLE IF NOT EXISTS eventos_gps (
  id           BIGSERIAL PRIMARY KEY,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  velocidad_kmh INTEGER NOT NULL DEFAULT 0,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_gps_vehiculo ON eventos_gps(vehiculo_id, creado_en DESC);

CREATE TABLE IF NOT EXISTS cargas_combustible (
  id           SERIAL PRIMARY KEY,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id),
  pedido_id    INTEGER REFERENCES pedidos(id),
  conductor_id INTEGER REFERENCES conductores(id),
  galones      NUMERIC(8,2) NOT NULL CHECK (galones > 0),
  costo_cop    INTEGER NOT NULL CHECK (costo_cop >= 0),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_combustible_fecha ON cargas_combustible(creado_en DESC);

CREATE TABLE IF NOT EXISTS ordenes_mantenimiento (
  id           SERIAL PRIMARY KEY,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id),
  tipo         TEXT NOT NULL CHECK (tipo IN ('preventivo', 'correctivo')),
  estado       TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
  descripcion  TEXT,
  costo_cop    INTEGER NOT NULL DEFAULT 0,
  creada_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrada_en   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_estado ON ordenes_mantenimiento(estado);

CREATE TABLE IF NOT EXISTS incidentes (
  id           SERIAL PRIMARY KEY,
  vehiculo_id  INTEGER NOT NULL REFERENCES vehiculos(id),
  conductor_id INTEGER REFERENCES conductores(id),
  tipo         TEXT NOT NULL CHECK (tipo IN ('accidente', 'falla_mecanica', 'desvio', 'robo', 'otro')),
  descripcion  TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incidentes_fecha ON incidentes(creado_en DESC);
