import { entero, manejar } from "@/lib/api";
import { datosConductor } from "@/lib/flota";
import { ErrorDeNegocio } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return manejar(async () => {
    const d = await datosConductor(entero((await ctx.params).id, "El conductor"));
    if (!d) throw new ErrorDeNegocio("Conductor no encontrado.", 404);
    return d;
  });
}
