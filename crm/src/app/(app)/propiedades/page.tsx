import type { Metadata } from "next";

import { EmptyState } from "@/components/layout/EmptyState";

export const metadata: Metadata = {
  title: "Propiedades · CRM Inmobiliario",
};

/** Placeholder de Propiedades (Task 7). */
export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Propiedades</h1>
      <EmptyState description="El listado de inmuebles con filtros y fichas llegará en las próximas iteraciones." />
    </>
  );
}
