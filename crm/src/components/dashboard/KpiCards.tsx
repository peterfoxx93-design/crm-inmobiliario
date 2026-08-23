import {
  CalendarCheck2,
  Building2,
  Clock,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";

import { formatDeltaPercent } from "@/lib/dashboard";
import { formatCompactEur, formatCurrency } from "@/lib/format";
import type { KpiStats } from "@/lib/queries/stats";

/**
 * Tarjetas KPI del Dashboard (Task 15). Server component: recibe los datos
 * ya cargados; el delta usa flecha verde (mejora) / roja (empeora) con
 * tooltip explicativo nativo (`title`).
 */

interface DeltaChipProps {
  deltaPct: number | null;
  /** Explicacion para el tooltip nativo. */
  title: string;
}

function DeltaChip({ deltaPct, title }: DeltaChipProps) {
  const text = formatDeltaPercent(deltaPct);
  if (deltaPct === null || text === null) {
    return (
      <span
        title={`${title} Sin datos del periodo anterior para comparar.`}
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
      >
        — <span className="sr-only">Sin comparación disponible</span>
      </span>
    );
  }

  const up = deltaPct > 0;
  const down = deltaPct < 0;
  const Arrow = up ? TrendingUp : down ? TrendingDown : Clock;
  return (
    <span
      title={
        up
          ? `${title} Más que en los 7 días anteriores.`
          : down
            ? `${title} Menos que en los 7 días anteriores.`
            : `${title} Igual que en los 7 días anteriores.`
      }
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        up
          ? "bg-green-100 text-green-800"
          : down
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 text-gray-600"
      }`}
    >
      {/* Flecha verde = mejora, roja = empeora (paleta operativa). */}
      <Arrow aria-hidden className="size-3" />
      {text}
      <span className="sr-only">
        {up ? "mejora" : down ? "empeora" : "sin cambio"} frente a la semana
        anterior
      </span>
    </span>
  );
}

export function KpiCards({ stats }: { stats: KpiStats }) {
  return (
    <section
      aria-label="Indicadores clave"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* Leads nuevos 7 dias + delta vs semana previa */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">Leads nuevos (7 días)</p>
          <UserPlus aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {stats.leadsNuevos7d}
        </p>
        <div className="mt-2">
          <DeltaChip
            deltaPct={stats.deltaLeadsPct}
            title="Comparado con los 7 días anteriores."
          />
        </div>
      </div>

      {/* Propiedades activas */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">Propiedades activas</p>
          <Building2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {stats.propiedadesActivas}
        </p>
        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground" title="Publicaciones con estado «Activo» en tu agencia.">
          Estado «Activo» en cartera
        </p>
      </div>

      {/* Visitas del mes */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">Visitas este mes</p>
          <CalendarCheck2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.visitasMes}</p>
        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground" title="Actividades de tipo «Visita» registradas desde el día 1 del mes actual.">
          Visitas registradas en el mes
        </p>
      </div>

      {/* Valor del pipeline (deals abiertos) */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">Valor del pipeline</p>
          <Wallet aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <p
          className="mt-2 text-2xl font-semibold tabular-nums"
          title={`Importe exacto: ${formatCurrency(stats.valorPipeline)}`}
        >
          {formatCompactEur(stats.valorPipeline)}
        </p>
        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground" title="Suma del importe de las ofertas abiertas (no ganadas ni perdidas).">
          Ofertas abiertas sin cerrar
        </p>
      </div>
    </section>
  );
}
