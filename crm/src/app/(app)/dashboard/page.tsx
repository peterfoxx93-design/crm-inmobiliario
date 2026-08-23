import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";

import { KpiCards } from "@/components/dashboard/KpiCards";
import { PipelineFunnel } from "@/components/dashboard/PipelineFunnel";
import { TodayPanel } from "@/components/dashboard/TodayPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFunnel,
  getKpiStats,
  getTodayData,
  resolveDashboardContext,
} from "@/lib/queries/stats";

export const metadata: Metadata = {
  title: "Dashboard · CRM Inmobiliario",
};

/**
 * Dashboard (Task 15): KPIs + embudo + panel del dia con alcance por rol
 * resuelto en servidor (agent ve solo lo asignado). Tres boundaries de
 * Suspense independientes, cada uno con su skeleton; el contexto
 * (usuario/perfil/settings) se resuelve una vez y alimenta a los tres.
 */

// --- Skeletons locales (uno por widget) ---

function KpiSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 rounded-xl border bg-card p-4">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`space-y-3 rounded-xl border bg-card p-4 ${className ?? ""}`}
    >
      <Skeleton className="h-4 w-40" />
      <div className="h-56" aria-hidden />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function WidgetError({ what }: { what: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={`No se ha podido cargar ${what}`}
      description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
    />
  );
}

// --- Widgets async (cada uno con su boundary) ---
// Patron agenda: los datos se cargan dentro de try/catch y el JSX se
// construye FUERA del bloque (react-hooks/error-boundaries).

async function KpisSection() {
  const ctx = await resolveDashboardContext();
  if (!ctx) return <WidgetError what="los indicadores" />;

  let stats;
  try {
    stats = await getKpiStats(ctx);
  } catch {
    // BD sin migrar / red: respuesta amable en lugar de error 500.
    return <WidgetError what="los indicadores" />;
  }
  return <KpiCards stats={stats} />;
}

async function FunnelSection() {
  const ctx = await resolveDashboardContext();
  if (!ctx) return <WidgetError what="el embudo" />;

  let funnel;
  try {
    funnel = await getFunnel(ctx);
  } catch {
    return <WidgetError what="el embudo" />;
  }
  return <PipelineFunnel data={funnel} />;
}

async function TodaySection() {
  const ctx = await resolveDashboardContext();
  if (!ctx) return <WidgetError what="el panel del día" />;

  let today;
  try {
    today = await getTodayData(ctx);
  } catch {
    return <WidgetError what="el panel del día" />;
  }
  return (
    <TodayPanel
      tareasHoy={today.tareasHoy}
      tareasVencidas={today.tareasVencidas}
      leadsSla={today.leadsSla}
    />
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          El pulso de tu agencia: leads, pipeline y lo que toca hoy.
        </p>
      </div>

      <Suspense fallback={<KpiSkeleton />}>
        <KpisSection />
      </Suspense>

      <Suspense
        fallback={<PanelSkeleton className="h-64 lg:w-1/2" />}
      >
        <FunnelSection />
      </Suspense>

      <Suspense fallback={<PanelSkeleton />}>
        <TodaySection />
      </Suspense>
    </div>
  );
}
