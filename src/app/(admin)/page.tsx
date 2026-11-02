import { TableroVivo } from "@/components/TableroVivo";
import { ErrorDatos } from "@/components/ErrorDatos";
import { obtenerDashboard } from "@/lib/dashboard";
import { simuladorActivo } from "@/lib/simulador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Centro de control" };

export default async function Page() {
  try {
    const inicial = await obtenerDashboard();
    return <TableroVivo inicial={inicial} demo={simuladorActivo()} />;
  } catch (e) {
    return <ErrorDatos error={e} />;
  }
}
