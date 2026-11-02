"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Vuelve a pedir los datos del servidor cada cierto tiempo, sin recargar la página. */
export function AutoRefresh({ cadaMs = 10000 }: { cadaMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) router.refresh(); }, cadaMs);
    return () => clearInterval(id);
  }, [router, cadaMs]);
  return null;
}
