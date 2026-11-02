import Link from "next/link";
import { BuscarGuia } from "@/components/BuscarGuia";
import { query } from "@/lib/db";
import { simuladorActivo } from "@/lib/simulador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sigue tu pedido" };

async function ejemplos(): Promise<string[]> {
  if (!simuladorActivo()) return [];
  try {
    const rows = await query<{ codigo: string }>(`SELECT codigo FROM pedidos WHERE estado = 'en_ruta' ORDER BY salida_en DESC LIMIT 3`);
    return rows.map((r) => r.codigo);
  } catch {
    return [];
  }
}

export default async function Page() {
  const codigos = await ejemplos();
  return (
    <>
      <h1 className="cartel">Sigue tu pedido</h1>
      <p style={{ marginTop: 14, maxWidth: "58ch", fontSize: 18 }}>
        Escribe el código que recibiste por correo o mensaje y mira dónde va tu mercancía, sin llamar a nadie.
      </p>
      <BuscarGuia />
      {codigos.length > 0 && (
        <p className="ejemplos">
          Pedidos de la demostración en ruta:{" "}
          {codigos.map((c) => <Link key={c} href={`/seguimiento/${c}`}>{c}</Link>)}
        </p>
      )}
    </>
  );
}
