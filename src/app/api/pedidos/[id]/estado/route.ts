import { entero, leerJson, manejar } from "@/lib/api";
import { cambiarEstado, ErrorDeNegocio } from "@/lib/pedidos";
import type { EstadoPedido } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALIDOS: EstadoPedido[] = ["en_ruta", "entregado", "cancelado"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return manejar(async () => {
    const id = entero((await ctx.params).id, "El pedido");
    const b = await leerJson<{ estado?: string; nota?: string }>(req);
    if (!b.estado || !VALIDOS.includes(b.estado as EstadoPedido)) throw new ErrorDeNegocio("Estado no válido.");
    return cambiarEstado(id, b.estado as EstadoPedido, b.nota?.slice(0, 200));
  });
}
