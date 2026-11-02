/** Barras decorativas derivadas del código (como la etiqueta de una guía de transporte). No es un estándar escaneable. */
export function CodigoBarras({ codigo }: { codigo: string }) {
  const barras: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of `${codigo}${codigo}`) {
    const c = ch.charCodeAt(0);
    for (let b = 0; b < 3; b++) {
      const w = 1 + ((c >> (b * 2)) & 3) % 3;
      barras.push({ x, w });
      x += w + 1 + ((c >> b) & 1);
    }
  }
  return (
    <svg className="codigo-barras" viewBox={`0 0 ${x} 30`} width={Math.min(x, 190)} preserveAspectRatio="none" aria-hidden="true">
      {barras.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={30} fill="#1d2327" />)}
    </svg>
  );
}
