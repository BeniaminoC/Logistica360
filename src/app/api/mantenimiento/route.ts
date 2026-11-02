import { entero, leerJson, manejar } from "@/lib/api";
import { abrirMantenimiento } from "@/lib/flota";
import { ErrorDeNegocio } from "@/lib/pedidos";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return manejar(async () => {
    const b = await leerJson<{ vehiculo_id?: number; tipo?: string; descripcion?: string }>(req);
    if (b.tipo !== "preventivo" && b.tipo !== "correctivo") throw new ErrorDeNegocio("Indica si el mantenimiento es preventivo o correctivo.");
    return abrirMantenimiento(entero(b.vehiculo_id, "El vehículo"), b.tipo, (b.descripcion ?? "").slice(0, 200));
  });
}
