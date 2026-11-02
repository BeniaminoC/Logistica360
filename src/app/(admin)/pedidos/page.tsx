import Link from "next/link";
import { AccionesPedido } from "@/components/AccionesPedido";
import { ErrorDatos } from "@/components/ErrorDatos";
import { FormPedido } from "@/components/FormPedido";
import { conteoPorEstado, listarCentros, listarClientes, listarPedidos } from "@/lib/pedidos";
import { ESTADO_PEDIDO, fechaHora, num } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

const PESTANAS = [
  { clave: "todos", texto: "Todos" },
  { clave: "pendiente", texto: "Sin vehículo" },
  { clave: "asignado", texto: "Por salir" },
  { clave: "en_ruta", texto: "En ruta" },
  { clave: "entregado", texto: "Entregados" },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const { estado = "todos", q = "" } = await searchParams;
  try {
    const [pedidos, conteo, centros, clientes] = await Promise.all([
      listarPedidos({ estado, q, limite: 120 }), conteoPorEstado(), listarCentros(), listarClientes(),
    ]);
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);
    const href = (clave: string) => `/pedidos?${new URLSearchParams({ ...(clave !== "todos" ? { estado: clave } : {}), ...(q ? { q } : {}) })}`;

    return (
      <>
        <header className="encabezado">
          <div>
            <h1 className="cartel">Pedidos</h1>
            <p>Desde que entra el pedido hasta que el cliente lo recibe. Cada cambio de estado queda en la línea de tiempo que ve el cliente.</p>
          </div>
          <div className="acciones-encabezado">
            <a className="boton claro" href="/api/reportes/pedidos?dias=30" download>Descargar últimos 30 días (CSV)</a>
            <FormPedido centros={centros} clientes={clientes} />
          </div>
        </header>

        <nav className="pestanas" aria-label="Filtrar por estado">
          {PESTANAS.map((p) => (
            <Link key={p.clave} href={href(p.clave)} aria-current={estado === p.clave ? "page" : undefined}>
              {p.texto} <small className="num">{p.clave === "todos" ? num(total) : num(conteo[p.clave] ?? 0)}</small>
            </Link>
          ))}
        </nav>

        <div className="barra-herramientas">
          <form className="buscador" action="/pedidos" role="search">
            {estado !== "todos" && <input type="hidden" name="estado" value={estado} />}
            <input type="search" name="q" defaultValue={q} placeholder="Código, cliente, ciudad o placa" aria-label="Buscar pedidos" />
            <button className="boton claro" type="submit">Buscar</button>
          </form>
          <span className="tenue" style={{ color: "var(--texto-2)" }}>{pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}{pedidos.length === 120 ? " (se muestran los primeros 120)" : ""}</span>
        </div>

        <div className="panel tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th><th>Cliente</th><th>Destino</th><th className="der">Peso</th><th>Vehículo</th><th>Compromiso</th><th>Estado</th><th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 && (
                <tr><td colSpan={8} className="vacio" style={{ padding: 22 }}>No hay pedidos con ese filtro. Prueba otra pestaña o registra uno nuevo.</td></tr>
              )}
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/seguimiento/${p.codigo}`}>{p.codigo}</Link></td>
                  <td>{p.cliente}<div className="tenue">sale de {p.centro}</div></td>
                  <td>{p.destino_ciudad}<div className="tenue">{num(p.distancia_km)} km</div></td>
                  <td className="der num">{num(p.peso_kg)} kg</td>
                  <td>{p.placa ?? <span className="tenue">—</span>}{p.conductor && <div className="tenue">{p.conductor}</div>}</td>
                  <td className="num">{fechaHora(p.entregado_en ?? p.prometido_en)}{p.retrasado && <div><span className="sello retraso">{p.estado === "entregado" ? "Llegó tarde" : "Retrasado"}</span></div>}</td>
                  <td><span className={`sello ${p.estado}`}>{ESTADO_PEDIDO[p.estado]}</span></td>
                  <td><AccionesPedido id={p.id} estado={p.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } catch (e) {
    return <ErrorDatos error={e} />;
  }
}
