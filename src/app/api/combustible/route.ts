import { entero, leerJson, manejar } from "@/lib/api";
import { registrarCombustible } from "@/lib/flota";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return manejar(async () => {
    const b = await leerJson<{ vehiculo_id?: number; conductor_id?: number; galones?: number; costo_cop?: number }>(req);
    return registrarCombustible({
      vehiculo_id: entero(b.vehiculo_id, "El vehículo"),
      conductor_id: b.conductor_id ? entero(b.conductor_id, "El conductor") : undefined,
      galones: Number(b.galones), costo_cop: Number(b.costo_cop),
    });
  });
}
