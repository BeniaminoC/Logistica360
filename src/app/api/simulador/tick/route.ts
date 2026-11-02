import { manejar } from "@/lib/api";
import { ErrorDeNegocio } from "@/lib/pedidos";
import { ejecutarTick, simuladorActivo } from "@/lib/simulador";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Avanza la simulación un paso. Solo disponible mientras DEMO_MODE no sea "false". */
export async function POST() {
  return manejar(async () => {
    if (!simuladorActivo()) throw new ErrorDeNegocio("El simulador está desactivado en este entorno.", 403);
    return ejecutarTick();
  });
}
