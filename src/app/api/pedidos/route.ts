import { entero, leerJson, manejar } from "@/lib/api";
import { asignarPedido, crearPedido, listarPedidos } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  return manejar(() => listarPedidos({ estado: u.searchParams.get("estado") ?? undefined, q: u.searchParams.get("q") ?? undefined }));
}

/** Crea el pedido y, de inmediato, intenta asignarle vehículo y conductor. */
export async function POST(req: Request) {
  return manejar(async () => {
    const b = await leerJson<Record<string, unknown>>(req);
    const pedido = await crearPedido({
      cliente_id: b.cliente_id ? entero(b.cliente_id, "El cliente") : undefined,
      cliente_nombre: typeof b.cliente_nombre === "string" ? b.cliente_nombre : undefined,
      centro_id: entero(b.centro_id, "El centro de distribución"),
      destino_ciudad: String(b.destino_ciudad ?? ""),
      destino_direccion: String(b.destino_direccion ?? ""),
      peso_kg: Number(b.peso_kg),
    });
    const asignacion = await asignarPedido(pedido.id);
    return { ...pedido, asignacion };
  });
}
