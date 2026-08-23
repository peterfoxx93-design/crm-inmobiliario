import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/EmptyState";

export const metadata: Metadata = {
  title: "Agenda · CRM Inmobiliario",
};

/** Placeholder de Agenda (Task 7). */
export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Agenda</h1>
      <EmptyState description="El calendario de visitas y tareas estará disponible próximamente." />
    </>
  );
}
