import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle, Users } from "lucide-react";

import { ContactsFilterBar } from "@/components/contacts/ContactsFilterBar";
import { ContactsTable } from "@/components/contacts/ContactsTable";
import { NewContactButton } from "@/components/contacts/NewContactButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import {
  CONTACT_PAGE_SIZE,
  contactFiltersToSearchParams,
  hasActiveContactFilters,
  parseContactFilters,
} from "@/lib/contact-filters";
import { listContacts } from "@/lib/queries/contacts";
import { listPropertyOptions } from "@/lib/queries/properties";

export const metadata: Metadata = {
  title: "Contactos · CRM Inmobiliario",
};

interface PageProps {
  /** Next 16: searchParams es una Promise. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Listado de contactos con ficha 360 (Task 12). Mismo patron server-first
 * que propiedades: boundary Suspense claveado por querystring.
 */
export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const keyParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) keyParams.set(key, first);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Contactos</h1>
          <p className="text-sm text-muted-foreground">
            Leads y clientes de la agencia con su historial completo.
          </p>
        </div>
        <NewContactButton />
      </div>

      <Suspense
        key={keyParams.toString()}
        fallback={<TableSkeleton rows={8} columns={7} />}
      >
        <ContactsContent params={params} />
      </Suspense>
    </div>
  );
}

async function ContactsContent({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const filters = parseContactFilters(params);

  let result;
  let propertyOptions: Array<{ id: string; title: string; reference: string }> = [];
  try {
    [result, propertyOptions] = await Promise.all([
      listContacts(filters),
      listPropertyOptions(),
    ]);
  } catch {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se han podido cargar los contactos"
        description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
      />
    );
  }

  if (result.total === 0) {
    return (
      <>
        <ContactsFilterBar filters={filters} />
        <EmptyState
          icon={Users}
          title={
            hasActiveContactFilters(filters)
              ? "Ningún contacto coincide"
              : "Aún no hay contactos"
          }
          description={
            hasActiveContactFilters(filters)
              ? "Prueba a relajar los filtros para ampliar la búsqueda."
              : "Registra tu primer lead con el botón «Nuevo contacto»."
          }
        />
      </>
    );
  }

  const qs = contactFiltersToSearchParams(filters);
  function hrefFor(page: number): string {
    const next = new URLSearchParams(qs);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    const search = next.toString();
    return search ? `/contactos?${search}` : "/contactos";
  }
  const from = (filters.page - 1) * CONTACT_PAGE_SIZE + 1;
  const to = Math.min(filters.page * CONTACT_PAGE_SIZE, result.total);

  return (
    <>
      <ContactsFilterBar filters={filters} />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {result.total} {result.total === 1 ? "contacto" : "contactos"}
      </p>

      <ContactsTable
        contacts={result.contacts}
        propertyOptions={propertyOptions}
      />

      <nav
        aria-label="Paginación de contactos"
        className="flex items-center justify-between gap-2"
      >
        <p className="text-xs text-muted-foreground">
          Mostrando {from}–{to} de {result.total}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {filters.page > 1 ? (
            <a href={hrefFor(filters.page - 1)} className="underline underline-offset-2">
              Anterior
            </a>
          ) : (
            <span>Anterior</span>
          )}
          <span>
            Página {filters.page} de {result.pageCount}
          </span>
          {filters.page < result.pageCount ? (
            <a href={hrefFor(filters.page + 1)} className="underline underline-offset-2">
              Siguiente
            </a>
          ) : (
            <span>Siguiente</span>
          )}
        </div>
      </nav>
    </>
  );
}
