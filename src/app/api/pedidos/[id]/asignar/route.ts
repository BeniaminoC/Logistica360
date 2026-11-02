import { entero, manejar } from "@/lib/api";
import { asignarPedido } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return manejar(async () => asignarPedido(entero((await ctx.params).id, "El pedido")));
}
