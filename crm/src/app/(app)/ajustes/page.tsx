import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = {
  title: "Ajustes · CRM Inmobiliario",
};

/** Placeholder de Ajustes (Task 7). */
export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Ajustes</h1>
      <EmptyState description="La configuración de la agencia (branding, SLA, equipo) estará disponible próximamente." />
    </>
  );
}
