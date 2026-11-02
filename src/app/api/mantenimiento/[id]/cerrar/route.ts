import { entero, leerJson, manejar } from "@/lib/api";
import { cerrarMantenimiento } from "@/lib/flota";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return manejar(async () => {
    const id = entero((await ctx.params).id, "La orden");
    const b = await leerJson<{ costo_cop?: number }>(req);
    return cerrarMantenimiento(id, Number(b.costo_cop ?? 0));
  });
}
