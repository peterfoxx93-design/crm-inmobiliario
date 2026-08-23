import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { EmptyState } from "@/components/shared/EmptyState";
import { getAgencyPipelineDays, listDeals } from "@/lib/queries/deals";

export const metadata: Metadata = {
  title: "Pipeline · CRM Inmobiliario",
};

/**
 * Pipeline kanban (Task 13). Server component: carga deals abiertos y
 * umbrales SLA de la agencia; el board cliente gestiona DnD y drawer.
 */
export default async function PipelinePage() {
  let deals;
  let stageDays;
  try {
    [deals, stageDays] = await Promise.all([listDeals(), getAgencyPipelineDays()]);
  } catch {
    return (
      <>
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Pipeline</h1>
        <EmptyState
          icon={AlertTriangle}
          title="No se ha podido cargar el pipeline"
          description="Comprueba tu conexión e inténtalo de nuevo."
        />
      </>
    );
  }

  if (deals.length === 0) {
    return (
      <>
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Pipeline</h1>
        <EmptyState
          title="Aún no hay ofertas en el pipeline"
          description="Crea una oferta desde la ficha de un contacto para verla aquí."
        />
      </>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Pipeline</h1>
      <KanbanBoard deals={deals} stageDays={stageDays} />
    </>
  );
}
