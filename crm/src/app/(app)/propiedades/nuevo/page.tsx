import type { Metadata } from "next";

import { PropertyForm } from "@/components/properties/PropertyForm";

export const metadata: Metadata = {
  title: "Nueva propiedad · CRM Inmobiliario",
};

/**
 * Alta de propiedad (Task 10): formulario en blanco; la propiedad se crea
 * siempre como borrador con referencia REF-XXXX generada en servidor.
 */
export default function NuevaPropiedadPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Nueva propiedad</h1>
        <p className="text-sm text-muted-foreground">
          Da de alta un inmueble: se creará como borrador hasta que la actives.
        </p>
      </header>

      <PropertyForm mode="create" />
    </div>
  );
}
