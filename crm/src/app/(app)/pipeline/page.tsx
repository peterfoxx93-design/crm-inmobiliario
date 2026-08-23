import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = {
  title: "Pipeline · CRM Inmobiliario",
};

/** Placeholder del Pipeline kanban (Task 7). */
export default function PipelinePage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Pipeline</h1>
      <EmptyState description="El tablero de oportunidades por etapa estará disponible próximamente." />
    </>
  );
}
