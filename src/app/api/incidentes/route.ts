import { entero, leerJson, manejar } from "@/lib/api";
import { registrarIncidente } from "@/lib/flota";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return manejar(async () => {
    const b = await leerJson<{ vehiculo_id?: number; conductor_id?: number; tipo?: string; descripcion?: string }>(req);
    return registrarIncidente({
      vehiculo_id: entero(b.vehiculo_id, "El vehículo"),
      conductor_id: b.conductor_id ? entero(b.conductor_id, "El conductor") : undefined,
      tipo: String(b.tipo ?? ""), descripcion: b.descripcion?.slice(0, 300),
    });
  });
}
