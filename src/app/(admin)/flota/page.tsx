import Link from "next/link";
import { BotonTaller, CerrarOrden } from "@/components/AccionesFlota";
import { ErrorDatos } from "@/components/ErrorDatos";
import { KM_PREVENTIVO } from "@/lib/dashboard";
import { listarFlota, listarOrdenes, preventivosPendientes } from "@/lib/flota";
import { cop, fechaHora, hace, num } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Flota y taller" };

const FILTROS = [
  { clave: "todos", texto: "Toda la flota" },
  { clave: "activo", texto: "Activos" },
  { clave: "mantenimiento", texto: "En taller" },
  { clave: "inactivo", texto: "Inactivos" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ vista?: string; estado?: string; q?: string }> }) {
  const { vista = "flota", estado = "todos", q = "" } = await searchParams;
  const enTaller = vista === "mantenimiento";
  try {
    // Se resuelve aquí, dentro del try, para que un fallo de base de datos muestre el aviso claro.
    const cuerpo = enTaller ? await Taller() : await Vehiculos({ estado, q });
    return (
      <>
        <header className="encabezado">
          <div>
            <h1 className="cartel">Flota y taller</h1>
            <p>Dónde está cada vehículo, cuánto servicio lleva y qué mantenimiento viene. Se atiende antes de que el vehículo falle en ruta.</p>
          </div>
        </header>
        <nav className="pestanas" aria-label="Vista">
          <Link href="/flota" aria-current={!enTaller ? "page" : undefined}>Vehículos</Link>
          <Link href="/flota?vista=mantenimiento" aria-current={enTaller ? "page" : undefined}>Mantenimiento</Link>
        </nav>
        {cuerpo}
      </>
    );
  } catch (e) {
    return <ErrorDatos error={e} />;
  }
}

async function Vehiculos({ estado, q }: { estado: string; q: string }) {
  const vehiculos = await listarFlota({ estado, q });
  return (
    <>
      <div className="barra-herramientas">
        <form className="buscador" action="/flota" role="search">
          {estado !== "todos" && <input type="hidden" name="estado" value={estado} />}
          <input type="search" name="q" defaultValue={q} placeholder="Placa, conductor o ciudad" aria-label="Buscar vehículos" />
          <button className="boton claro" type="submit">Buscar</button>
        </form>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTROS.map((f) => (
            <Link key={f.clave} className="boton chico claro" href={`/flota?${new URLSearchParams({ ...(f.clave !== "todos" ? { estado: f.clave } : {}), ...(q ? { q } : {}) })}`}
              aria-current={estado === f.clave ? "page" : undefined} style={estado === f.clave ? { background: "var(--asfalto)", color: "#fff", borderColor: "var(--asfalto)" } : undefined}>
              {f.texto}
            </Link>
          ))}
        </div>
      </div>
      <div className="panel tabla-caja">
        <table className="tabla">
          <thead>
            <tr><th>Placa</th><th>Tipo</th><th>Centro</th><th>Conductor</th><th>Situación</th><th>Última señal</th><th>Desde el último servicio</th><th><span className="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            {vehiculos.length === 0 && <tr><td colSpan={8} className="vacio" style={{ padding: 22 }}>Ningún vehículo coincide con la búsqueda.</td></tr>}
            {vehiculos.map((v) => {
              const pct = Math.min(100, (v.km_desde_servicio / KM_PREVENTIVO) * 100);
              const vencido = v.km_desde_servicio >= KM_PREVENTIVO;
              const situacion =
                v.estado !== "activo" ? v.estado
                : v.pedido_estado === "en_ruta" && v.sin_senal ? "sin_senal"
                : v.pedido_estado ? v.pedido_estado : "disponible";
              const etiqueta: Record<string, string> = { mantenimiento: "En taller", inactivo: "Inactivo", sin_senal: "Sin señal", en_ruta: "En ruta", asignado: "Por salir", disponible: "Disponible" };
              return (
                <tr key={v.id}>
                  <td><strong>{v.placa}</strong></td>
                  <td>{v.tipo}<div className="tenue">{num(v.capacidad_kg)} kg</div></td>
                  <td>{v.centro}</td>
                  <td>{v.conductor ?? "—"}</td>
                  <td><span className={`sello ${situacion}`}>{etiqueta[situacion]}</span>{v.pedido && <div className="tenue">{v.pedido} → {v.destino}</div>}</td>
                  <td className="num">{hace(v.ultima_senal)}</td>
                  <td>
                    <span className="medidor" aria-hidden="true"><i className={vencido ? "alto" : ""} style={{ width: `${pct}%` }} /></span>
                    <span className="num" style={{ color: vencido ? "var(--rojo)" : undefined, fontWeight: vencido ? 600 : 400 }}>{num(v.km_desde_servicio)} km</span>
                  </td>
                  <td>
                    <div className="acciones-fila">
                      {v.estado === "activo" && !v.pedido && <BotonTaller vehiculoId={v.id} tipoInicial={vencido ? "preventivo" : "correctivo"} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function Taller() {
  const [abiertas, cerradas, pendientes] = await Promise.all([listarOrdenes("abierta", 30), listarOrdenes("cerrada", 8), preventivosPendientes()]);
  return (
    <>
      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-cabeza"><h2>Servicio preventivo vencido</h2><span className="ayuda">más de {num(KM_PREVENTIVO)} km desde el último servicio</span></div>
        <div className="tabla-caja">
          <table className="tabla">
            <tbody>
              {pendientes.length === 0 && <tr><td className="vacio" style={{ padding: "6px 18px 18px" }}>Todos los vehículos activos están al día.</td></tr>}
              {pendientes.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.placa}</strong> <span className="tenue">{v.tipo}</span></td>
                  <td className="num" style={{ color: "var(--rojo)", fontWeight: 600 }}>{num(v.km_desde_servicio)} km</td>
                  <td><div className="acciones-fila"><BotonTaller vehiculoId={v.id} tipoInicial="preventivo" etiqueta="Programar servicio" /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-cabeza"><h2>Órdenes abiertas</h2><span className="ayuda">{abiertas.length} en taller</span></div>
        <div className="tabla-caja">
          <table className="tabla">
            <tbody>
              {abiertas.length === 0 && <tr><td className="vacio" style={{ padding: "6px 18px 18px" }}>No hay vehículos en taller.</td></tr>}
              {abiertas.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.placa}</strong></td>
                  <td><span className={`sello ${o.tipo === "preventivo" ? "activo" : "mantenimiento"}`}>{o.tipo === "preventivo" ? "Preventivo" : "Correctivo"}</span></td>
                  <td>{o.descripcion}<div className="tenue">Abierta {hace(o.creada_en)}</div></td>
                  <td><CerrarOrden ordenId={o.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-cabeza"><h2>Cerradas recientemente</h2></div>
        <div className="tabla-caja">
          <table className="tabla">
            <tbody>
              {cerradas.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.placa}</strong></td>
                  <td>{o.tipo === "preventivo" ? "Preventivo" : "Correctivo"}</td>
                  <td>{o.descripcion}</td>
                  <td className="num der">{cop(o.costo_cop)}</td>
                  <td className="num tenue">{fechaHora(o.cerrada_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
