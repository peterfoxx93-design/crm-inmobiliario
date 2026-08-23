import type { Metadata } from "next";

import { PropiedadesDemo } from "./propiedades-demo";

export const metadata: Metadata = {
  title: "Propiedades · CRM Inmobiliario",
};

/**
 * Placeholder de Propiedades (Task 7) con demo de componentes compartidos
 * (Task 8). Los datos son hardcoded y temporales.
 * TODO(Task 9): sustituir por el listado real con Supabase + RLS.
 */
export default function Page() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold tracking-tight">Propiedades</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Demo temporal de tabla, badges, estados y skeletons; el listado real llega en la Task 9.
      </p>
      <PropiedadesDemo />
    </>
  );
}
