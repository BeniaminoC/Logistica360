import { AppConductor } from "@/components/AppConductor";
import { ErrorDatos } from "@/components/ErrorDatos";
import { listarConductores } from "@/lib/flota";

export const dynamic = "force-dynamic";
export const metadata = { title: "App del conductor" };

export default async function Page() {
  try {
    const conductores = await listarConductores();
    return (
      <>
        <header className="encabezado">
          <div>
            <h1 className="cartel">App del conductor</h1>
            <p>Una sola aplicación para recibir la orden, enviar la ubicación, registrar combustible y confirmar la entrega. Funciona sin señal y envía al volver la conexión.</p>
          </div>
        </header>
        <AppConductor conductores={conductores} />
      </>
    );
  } catch (e) {
    return <ErrorDatos error={e} />;
  }
}
