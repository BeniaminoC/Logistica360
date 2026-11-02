import { NextResponse } from "next/server";
import { leerJson, manejar } from "@/lib/api";
import { registrarGps } from "@/lib/flota";

export const dynamic = "force-dynamic";

/**
 * Ingesta de posición. Los dispositivos GPS/IoT envían:
 *   POST /api/gps  { "placa": "ABC123", "lat": 8.75, "lng": -75.88, "velocidad_kmh": 62 }
 * con la cabecera `x-api-key` si se definió GPS_API_KEY. La app del conductor usa la sesión del sitio.
 */
export async function POST(req: Request) {
  const clave = process.env.GPS_API_KEY;
  const autorizado =
    !clave || req.headers.get("x-api-key") === clave || (!!process.env.APP_PASSWORD && !!req.headers.get("authorization"));
  if (!autorizado) return NextResponse.json({ error: "Clave de API inválida." }, { status: 401 });

  return manejar(async () => {
    const b = await leerJson<{ vehiculo_id?: number; placa?: string; lat?: number; lng?: number; velocidad_kmh?: number }>(req);
    return registrarGps({ vehiculo_id: b.vehiculo_id, placa: b.placa, lat: Number(b.lat), lng: Number(b.lng), velocidad_kmh: b.velocidad_kmh });
  });
}
