"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoCamion } from "./Logo";

const ENLACES = [
  { href: "/", texto: "Centro de control" },
  { href: "/pedidos", texto: "Pedidos" },
  { href: "/flota", texto: "Flota y taller" },
  { href: "/conductor", texto: "App del conductor" },
];

export function Riel() {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));
  return (
    <aside className="riel">
      <Link href="/" className="marca" aria-label="Logística360, ir al centro de control">
        <LogoCamion />
        <span>
          Logística360
          <small>Operación en tiempo real</small>
        </span>
      </Link>
      <nav className="nav" aria-label="Principal">
        {ENLACES.map((e) => (
          <Link key={e.href} href={e.href} aria-current={activo(e.href) ? "page" : undefined}>
            {e.texto}
          </Link>
        ))}
      </nav>
      <div className="riel-pie">
        <Link href="/seguimiento">Vista del cliente: seguir un pedido</Link>
      </div>
    </aside>
  );
}
