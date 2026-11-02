import { num } from "@/lib/format";

/** Fila con barra horizontal: etiqueta, barra proporcional y cifra. */
export function FilaBarra({ etiqueta, valor, maximo, color }: { etiqueta: string; valor: number; maximo: number; color: string }) {
  const pct = maximo > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / maximo) * 100) : 0;
  return (
    <div className="fila-barra">
      <span>{etiqueta}</span>
      <div className="pista" aria-hidden="true">
        <div className="relleno" style={{ width: `${pct}%`, background: color }} />
      </div>
      <b className="num">{num(valor)}</b>
    </div>
  );
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Barras de galones por día (últimos 7). */
export function BarrasPorDia({ datos }: { datos: { dia: string; galones: number }[] }) {
  const W = 360, H = 150, base = 120, margen = 8;
  const max = Math.max(...datos.map((d) => d.galones), 1);
  const ancho = (W - margen * 2) / datos.length;
  return (
    <svg className="barras-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Galones de combustible por día: ${datos.map((d) => `${d.dia} ${Math.round(d.galones)}`).join(", ")}`}>
      <line x1={margen} x2={W - margen} y1={base} y2={base} stroke="#1d2327" strokeWidth="2" />
      {datos.map((d, i) => {
        const h = (d.galones / max) * (base - 22);
        const x = margen + i * ancho + ancho * 0.16;
        const dia = DIAS[new Date(`${d.dia}T12:00:00`).getDay()];
        const hoy = i === datos.length - 1;
        return (
          <g key={d.dia}>
            <rect x={x} y={base - h} width={ancho * 0.68} height={Math.max(h, 1)} fill={hoy ? "#f5b700" : "#0e5a43"} rx="1.5" />
            <text x={x + ancho * 0.34} y={base - h - 5} textAnchor="middle" style={{ fontWeight: 600, fill: "#1b2024" }}>
              {d.galones ? Math.round(d.galones) : ""}
            </text>
            <text x={x + ancho * 0.34} y={base + 17} textAnchor="middle">{hoy ? "hoy" : dia}</text>
          </g>
        );
      })}
    </svg>
  );
}
