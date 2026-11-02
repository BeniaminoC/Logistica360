import { manejar } from "@/lib/api";
import { obtenerDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  return manejar(obtenerDashboard);
}
