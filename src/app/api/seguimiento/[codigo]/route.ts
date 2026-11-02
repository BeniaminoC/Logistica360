import { manejar } from "@/lib/api";
import { ErrorDeNegocio, obtenerSeguimiento } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

/** Ruta pública: el cliente consulta su pedido sin iniciar sesión, solo con el código. */
export async function GET(_req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  return manejar(async () => {
    const s = await obtenerSeguimiento(decodeURIComponent((await ctx.params).codigo));
    if (!s) throw new ErrorDeNegocio("No encontramos un pedido con ese código.", 404);
    return s;
  });
}
