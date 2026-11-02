"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BuscarGuia({ inicial = "" }: { inicial?: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(inicial);
  return (
    <form
      className="buscar-guia"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const c = codigo.trim().toUpperCase();
        if (c) router.push(`/seguimiento/${encodeURIComponent(c)}`);
      }}
    >
      <label htmlFor="codigo" className="sr-only">Código del pedido</label>
      <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="L360-XXXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      <button className="boton grande verde" style={{ width: "auto", minWidth: 180 }} type="submit">Ver mi pedido</button>
    </form>
  );
}
