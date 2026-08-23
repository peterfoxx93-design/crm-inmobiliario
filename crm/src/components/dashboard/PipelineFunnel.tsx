"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FunnelBar } from "@/lib/dashboard";

/**
 * Embudo de etapas del pipeline (Task 15). BarChart horizontal de recharts
 * con etiquetas en espanol (DEAL_STAGES) y paleta operativa:
 * gris = inicio sin trabajar, ambar = fases pendientes, verde = cierre.
 * El rojo queda reservado a alertas SLA, no se usa aqui.
 */

// Colores por etapa (semantica verde=activo / ambar=pendiente / gris=inicio).
const STAGE_COLORS: Record<FunnelBar["stage_id"], string> = {
  nuevo_lead: "#9ca3af", // gray-400
  calificado: "#f59e0b", // amber-500
  visita: "#d97706", // amber-600
  negociacion: "#b45309", // amber-700
  cierre: "#16a34a", // green-600
};

export function PipelineFunnel({ data }: { data: FunnelBar[] }) {
  return (
    <section aria-label="Embudo del pipeline" className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Embudo del pipeline</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Ofertas abiertas por etapa
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 36, bottom: 0, left: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              formatter={(value) => {
                const n = Number(value) || 0;
                return [`${n} ${n === 1 ? "oferta" : "ofertas"}`, "Etapa"];
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
              <LabelList
                dataKey="count"
                position="right"
                className="fill-foreground text-xs tabular-nums"
              />
              {data.map((entry) => (
                <Cell
                  key={entry.stage_id}
                  fill={STAGE_COLORS[entry.stage_id] ?? "#9ca3af"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
