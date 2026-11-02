# Logística360

Plataforma logística integrada para empresas de transporte y distribución: pedidos, flota, conductores, seguimiento para el cliente y centro de control en tiempo real. Implementa el flujo **Pedido → Asignación → Vehículo → Conductor → GPS → Entrega → Cliente** de la propuesta de arquitectura empresarial (Universidad de Córdoba, Ética Profesional).

**Stack:** Next.js 16 (App Router) · React 19 · PostgreSQL en **Aiven** · `pg` · Leaflet (OpenStreetMap) · despliegue en **Vercel**.

## Módulos y requerimientos que cubre

| Pantalla | Ruta | Requerimientos |
| --- | --- | --- |
| Centro de control (dashboard ejecutivo) | `/` | RF-09 |
| Pedidos, asignación y reporte CSV | `/pedidos` | RF-01, RF-02, RF-10 |
| Flota, mapa, taller y combustible | `/flota` | RF-03, RF-06, RF-07 |
| App del conductor (uso en ruta) | `/conductor` | RF-04, RF-08 |
| Seguimiento público del cliente | `/seguimiento` | RF-05 |
| Ingesta GPS por API | `POST /api/gps` | RF-03 |

## Ejecutar en local

```bash
npm install
cp .env.example .env.local      # pega aquí tu DATABASE_URL
npm run db:setup                # crea las tablas y carga datos de demostración
npm run dev                     # http://localhost:3000
```

Datos demo: 5 centros de distribución, 100 vehículos, 100 conductores y ~390 pedidos. Códigos de seguimiento de ejemplo aparecen en `/seguimiento`.

## 1. Subir a GitHub

```bash
git add .
git commit -m "Logística360: versión inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/logistica360.git
git push -u origin main
```

`.env.local` y los `*.pem` están en `.gitignore`: los secretos nunca se suben. El workflow `.github/workflows/ci.yml` valida tipos y compilación en cada push.

## 2. Base de datos en Aiven

1. En [console.aiven.io](https://console.aiven.io) crea un servicio **PostgreSQL** (el plan *Free* alcanza para la demo).
2. Cuando esté en estado *Running*, copia el **Service URI** y el **CA certificate** (`ca.pem`).
3. En `.env.local` pon `DATABASE_URL` (Service URI) y, recomendado, `DATABASE_CA_CERT` con el contenido del `ca.pem`.
4. En *Allowed IP addresses* del servicio, permite `0.0.0.0/0` (las IP de Vercel no son fijas) o usa el plan con VPC peering.
5. Desde tu computador: `npm run db:setup`. La migración es idempotente.

## 3. Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new) importa el repositorio de GitHub. Vercel detecta Next.js solo.
2. En *Settings → Environment Variables* carga las mismas variables que en `.env.example`:

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Service URI de Aiven |
| `DATABASE_CA_CERT` | Recomendada | Verifica el certificado del servidor |
| `APP_PASSWORD` | Recomendada | Protege el panel (usuario `admin`); el seguimiento del cliente sigue público |
| `GPS_API_KEY` | Si hay GPS reales | Cabecera `x-api-key` para `POST /api/gps` |
| `DEMO_MODE` | No | `true` habilita el simulador de GPS; ponlo en `false` en producción real |

3. *Deploy*. Cada `git push` a `main` vuelve a desplegar.

> La base se prepara una sola vez con `npm run db:setup` desde tu máquina; el build de Vercel no necesita conectarse a ella.

## API de integración (capa de APIs)

- `POST /api/gps` — un dispositivo GPS/IoT reporta `{ placa | vehiculo_id, lat, lng, velocidad_kmh }` con la cabecera `x-api-key`.
- `GET /api/dashboard` — indicadores del centro de control.
- `GET /api/seguimiento/[codigo]` — estado público de un pedido.
- `GET /api/reportes/pedidos` — CSV de los últimos 30 días.

## Estructura

```
db/schema.sql        esquema PostgreSQL (idempotente)
scripts/             migrate.mjs y seed.mjs
src/app/(admin)      panel interno
src/app/(publico)    seguimiento del cliente
src/app/api          endpoints
src/lib              acceso a datos y reglas (db, dashboard, pedidos, flota, simulador)
src/proxy.ts         protección opcional con APP_PASSWORD
```
