import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = {
  title: "Maestro · CRM Inmobiliario",
};

/**
 * Placeholder del panel Maestro (multi-agencia), solo visible para
 * `role='super_admin'` (la navegacion se filtra por rol en Sidebar).
 */
export default function MaestroPage() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Maestro</h1>
      <EmptyState description="La gestión multi-agencia (altas, bajas y branding) estará disponible próximamente." />
    </>
  );
}
