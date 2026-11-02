import Link from "next/link";
import { LogoCamion } from "@/components/Logo";

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="publico">
      <header className="publico-barra">
        <Link href="/seguimiento" className="marca" aria-label="Logística360, seguimiento de pedidos">
          <LogoCamion />
          <span>Logística360</span>
        </Link>
        <span style={{ color: "#c4ccd0", fontSize: 15 }}>Seguimiento de pedidos</span>
      </header>
      <main className="publico-cuerpo">{children}</main>
    </div>
  );
}
