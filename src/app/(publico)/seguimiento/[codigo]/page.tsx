import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BuscarGuia } from "@/components/BuscarGuia";
import { CodigoBarras } from "@/components/CodigoBarras";
import { MapaFlota } from "@/components/MapaFlota";
import { fechaHora, hace, hora, num } from "@/lib/format";
import { obtenerSeguimiento } from "@/lib/pedidos";
import type { VehiculoMapa } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }) {
  return { title: `Pedido ${decodeURIComponent((await params).codigo).toUpperCase()}` };
}

const TITULO: Record<string, string> = {
  pendiente: "Recibimos tu pedido",
  asignado: "Tu pedido está listo para salir",
  en_ruta: "Tu pedido va en camino",
  entregado: "Tu pedido fue entregado",
  cancelado: "Este pedido fue cancelado",
};

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = decodeURIComponent((await params).codigo);
  let s;
  try {
    s = await obtenerSeguimiento(codigo);
  } catch (e) {
    console.error("[seguimiento]", e);
    return (
      <>
        <h1 className="cartel">Sigue tu pedido</h1>
        <p className="aviso error" style={{ marginTop: 20 }} role="alert">No pudimos consultar tu pedido en este momento. Inténtalo de nuevo en unos minutos.</p>
      </>
    );
  }

  if (!s) {
    return (
      <>
        <h1 className="cartel">Sigue tu pedido</h1>
        <p className="aviso error" style={{ marginTop: 20 }} role="alert">
          No encontramos un pedido con el código <strong>{codigo}</strong>. Revisa que esté completo, por ejemplo L360-K7M2QX.
        </p>
        <BuscarGuia inicial={codigo} />
      </>
    );
  }

  const enCurso = s.estado === "asignado" || s.estado === "en_ruta";
  const vehiculoMapa: VehiculoMapa[] = s.vehiculo
    ? [{
        id: 0, placa: s.vehiculo.placa, tipo: s.vehiculo.tipo, lat: s.vehiculo.lat, lng: s.vehiculo.lng, velocidad_kmh: s.vehiculo.velocidad_kmh,
        ultima_senal: s.vehiculo.ultima_senal, conductor: s.conductor, pedido: s.codigo, destino: s.destino_ciudad,
        situacion: s.retrasado ? "retrasado" : s.estado === "en_ruta" ? "en_ruta" : "asignado",
      }]
    : [];
  const ultimo = s.eventos.length - 1;

  return (
    <>
      {enCurso && <AutoRefresh cadaMs={8000} />}
      <h1 className="cartel">{TITULO[s.estado]}</h1>

      <div className="guia">
        <section className="guia-ficha" aria-label="Datos del pedido">
          <div className="guia-cabeza">
            <div>
              <div className="codigo">{s.codigo}</div>
              <CodigoBarras codigo={s.codigo} />
            </div>
            {s.retrasado && s.estado !== "entregado" && <span className="sello retraso">Con retraso</span>}
          </div>
          <hr className="perforado" />
          <div className="eta">
            {s.estado === "entregado" ? (
              <>
                <div className="cifra-grande num">{fechaHora(s.entregado_en)}</div>
                <p className="vacio">{s.retrasado ? "Entregado después de lo prometido" : "Entregado dentro del tiempo prometido"}</p>
              </>
            ) : s.estado === "cancelado" ? (
              <p className="vacio">Si no pediste la cancelación, comunícate con tu asesor.</p>
            ) : (
              <>
                <div className="cifra-grande num" style={s.retrasado ? { color: "var(--rojo)" } : undefined}>{hora(s.prometido_en)}</div>
                <p className="vacio">
                  {s.retrasado
                    ? "Superamos la hora prometida. Tu pedido sigue en camino y seguimos monitoreándolo."
                    : `Hora estimada de llegada, ${fechaHora(s.prometido_en).split(",")[0]}`}
                </p>
              </>
            )}
          </div>
          <hr className="perforado" />
          <dl className="guia-datos">
            <div><dt>Entrega en</dt><dd>{s.destino_ciudad}</dd></div>
            <div><dt>Sale de</dt><dd>{s.origen.nombre}</dd></div>
            <div><dt>Carga</dt><dd className="num">{num(s.peso_kg)} kg</dd></div>
            {s.restanteKm !== null && <div><dt>Faltan aprox.</dt><dd className="num">{num(s.restanteKm)} km</dd></div>}
            {s.vehiculo && <div><dt>Vehículo</dt><dd>{s.vehiculo.placa}</dd></div>}
            {s.conductor && <div><dt>Conductor</dt><dd>{s.conductor}</dd></div>}
            {s.vehiculo && <div className="ancho"><dt>Última señal del vehículo</dt><dd>{hace(s.vehiculo.ultima_senal)}</dd></div>}
          </dl>
          <hr className="perforado" />
          <ol className="linea-tiempo" aria-label="Historial del pedido">
            {s.eventos.map((e, i) => (
              <li key={i} className={i === ultimo ? "ultimo" : undefined}>
                <b>{e.nota ?? e.estado}</b>
                <span>{fechaHora(e.creado_en)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel mapa-panel" aria-label="Mapa del recorrido" style={{ overflow: "hidden" }}>
          <div className="panel-cabeza">
            <h2>{enCurso ? "Dónde va tu pedido" : "Recorrido"}</h2>
            <span className="ayuda">{s.origen.nombre} → {s.destino_ciudad}</span>
          </div>
          <div className="mapa-caja" style={{ minHeight: 420 }}>
            <MapaFlota
              vehiculos={vehiculoMapa}
              ajustarA="puntos"
              puntos={[
                { lat: s.origen.lat, lng: s.origen.lng, etiqueta: s.origen.nombre, tipo: "origen" },
                { lat: s.destino.lat, lng: s.destino.lng, etiqueta: s.destino_ciudad, tipo: "destino" },
              ]}
              linea={[[s.origen.lat, s.origen.lng], [s.destino.lat, s.destino.lng]]}
            />
          </div>
        </section>
      </div>

      <p style={{ marginTop: 22 }}><Link href="/seguimiento" className="enlace" style={{ fontSize: 15 }}>Consultar otro pedido</Link></p>
    </>
  );
}
