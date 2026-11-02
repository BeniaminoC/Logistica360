import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Evita que Excel interprete celdas como fórmulas
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
};

/** Reporte bajo demanda (RF-10): todos los pedidos de los últimos N días en CSV. */
export async function GET(req: Request) {
  const dias = Math.min(Math.max(Number(new URL(req.url).searchParams.get("dias")) || 30, 1), 365);
  try {
    const rows = await query(
      `SELECT p.codigo, cl.nombre AS cliente, ce.nombre AS centro, p.destino_ciudad, p.destino_direccion, p.peso_kg, p.distancia_km,
              p.estado, v.placa, co.nombre AS conductor, p.creado_en, p.asignado_en, p.salida_en, p.entregado_en, p.prometido_en,
              CASE WHEN p.entregado_en IS NULL THEN NULL WHEN p.entregado_en <= p.prometido_en THEN 'si' ELSE 'no' END AS a_tiempo
       FROM pedidos p JOIN clientes cl ON cl.id = p.cliente_id JOIN centros ce ON ce.id = p.centro_id
       LEFT JOIN vehiculos v ON v.id = p.vehiculo_id LEFT JOIN conductores co ON co.id = p.conductor_id
       WHERE p.creado_en > now() - make_interval(days => $1) ORDER BY p.creado_en DESC`, [dias]
    );
    const cols = ["codigo", "cliente", "centro", "destino_ciudad", "destino_direccion", "peso_kg", "distancia_km", "estado", "placa", "conductor",
      "creado_en", "asignado_en", "salida_en", "entregado_en", "prometido_en", "a_tiempo"];
    const csv = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pedidos-ultimos-${dias}-dias.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reportes]", err);
    return NextResponse.json({ error: "No se pudo generar el reporte." }, { status: 500 });
  }
}
