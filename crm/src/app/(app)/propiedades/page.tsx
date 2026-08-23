import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, HousePlus, Plus } from "lucide-react";

import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyFiltersBar } from "@/components/properties/PropertyFilters";
import { CardGridSkeleton } from "@/components/shared/Skeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  PROPERTY_PAGE_SIZE,
  filtersToSearchParams,
  hasActivePropertyFilters,
  parsePropertyFilters,
  type PropertyFilters,
} from "@/lib/property-filters";
import {
  listProperties,
  type PropertyListResult,
} from "@/lib/queries/properties";

export const metadata: Metadata = {
  title: "Propiedades · CRM Inmobiliario",
};

interface PageProps {
  /** Next 16: searchParams es una Promise; se resuelve y se delega al contenido. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Listado de propiedades con filtros persistentes en la URL (Task 9).
 * El componente exterior resuelve `searchParams` y monta el contenido dentro
 * de un boundary Suspense claveado por querystring: al cambiar filtros
 * (`router.push` en transicion) se muestra un grid de skeletons.
 */
export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  // Clave estable del boundary Suspense: cualquier cambio de querystring
  // remonta el boundary y muestra el fallback de skeletons.
  const keyParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) keyParams.set(key, first);
  }
  const suspenseKey = keyParams.toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Propiedades</h1>
          <p className="text-sm text-muted-foreground">
            Cartera de inmuebles de la agencia con filtros y búsqueda.
          </p>
        </div>
        <Button render={<Link href="/propiedades/nueva" />}>
          <Plus data-icon="inline-start" aria-hidden />
          Nueva propiedad
        </Button>
      </div>

      <Suspense key={suspenseKey} fallback={<CardGridSkeleton />}>
        <PropertiesContent params={params} />
      </Suspense>
    </div>
  );
}

async function PropertiesContent({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const filters = parsePropertyFilters(params);

  let result: PropertyListResult;
  try {
    result = await listProperties(filters);
  } catch {
    // Fallo de red / BD sin migrar: respuesta amable en lugar de error 500.
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se han podido cargar las propiedades"
        description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
      />
    );
  }

  if (result.total === 0) {
    return hasActivePropertyFilters(filters) ? (
      <EmptyState
        title="Ninguna propiedad coincide"
        description="Prueba a relajar los filtros o elimina alguno para ampliar la búsqueda."
      />
    ) : (
      <EmptyState
        icon={HousePlus}
        title="Aún no hay propiedades"
        description="Da de alta tu primer inmueble para empezar a gestionar la cartera."
        cta={
          <Button render={<Link href="/propiedades/nueva" />}>
            <Plus data-icon="inline-start" aria-hidden />
            Nueva propiedad
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PropertyFiltersBar filters={filters} />

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {result.total} {result.total === 1 ? "propiedad" : "propiedades"}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {result.properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      <ListPagination filters={filters} total={result.total} pageCount={result.pageCount} />
    </>
  );
}

interface ListPaginationProps {
  filters: PropertyFilters;
  total: number;
  pageCount: number;
}

/** Paginacion servidor: enlaces previo/siguiente conservando todos los filtros. */
function ListPagination({ filters, total, pageCount }: ListPaginationProps) {
  const from = (filters.page - 1) * PROPERTY_PAGE_SIZE + 1;
  const to = Math.min(filters.page * PROPERTY_PAGE_SIZE, total);

  function hrefFor(page: number): string {
    const qs = filtersToSearchParams({ ...filters, page }).toString();
    return qs ? `/propiedades?${qs}` : "/propiedades";
  }

  const prevDisabled = filters.page <= 1;
  const nextDisabled = filters.page >= pageCount;

  return (
    <nav aria-label="Paginación de propiedades" className="flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        {prevDisabled ? (
          <Button variant="outline" size="sm" disabled>
            Anterior
          </Button>
        ) : (
          <Button variant="outline" size="sm" render={<Link href={hrefFor(filters.page - 1)} />}>
            Anterior
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Página {filters.page} de {pageCount}
        </span>
        {nextDisabled ? (
          <Button variant="outline" size="sm" disabled>
            Siguiente
          </Button>
        ) : (
          <Button variant="outline" size="sm" render={<Link href={hrefFor(filters.page + 1)} />}>
            Siguiente
          </Button>
        )}
      </div>
    </nav>
  );
}
