import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/EmptyState";

export const metadata: Metadata = {
  title: "Contactos · CRM Inmobiliario",
};

/** Placeholder de Contactos (Task 7). */
export default function Page() {
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold tracking-tight">Contactos</h1>
      <EmptyState description="La gestión de compradores, inquilinos y propietarios estará disponible próximamente." />
    </>
  );
}
