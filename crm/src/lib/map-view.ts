/**
 * Helpers puros de la vista mapa (Task 11). Sin dependencias de React,
 * Leaflet ni Supabase para poder testearlos en node.
 */

import { filtersToSearchParams, type PropertyFilters } from "@/lib/property-filters";

export type MapView = "lista" | "mapa";

interface Coords {
  lat: number | null;
  lng: number | null;
}

/** true si la propiedad tiene coordenadas utilizables en el mapa. */
function hasUsableCoords(item: Coords): boolean {
  return (
    typeof item.lat === "number" &&
    Number.isFinite(item.lat) &&
    typeof item.lng === "number" &&
    Number.isFinite(item.lng)
  );
}

/**
 * Separa los resultados entre ubicables y sin ubicación para el mapa
 * y el contador "N sin ubicación".
 */
export function splitByCoords<T extends Coords>(items: readonly T[]): {
  withCoords: T[];
  withoutCoords: T[];
} {
  const withCoords: T[] = [];
  const withoutCoords: T[] = [];
  for (const item of items) {
    (hasUsableCoords(item) ? withCoords : withoutCoords).push(item);
  }
  return { withCoords, withoutCoords };
}

/** Lee `vista` de los searchParams crudos; cualquier valor ajeno -> lista. */
export function parseViewParam(
  params: Record<string, string | string[] | undefined>,
): MapView {
  const raw = Array.isArray(params.vista) ? params.vista[0] : params.vista;
  return raw === "mapa" ? "mapa" : "lista";
}

/**
 * Serializa filtros + vista a querystring preservando todos los filtros
 * activos. `lista` se omite (es el estado por defecto).
 */
export function viewToSearchParams(
  filters: PropertyFilters,
  view: MapView,
): URLSearchParams {
  const sp = filtersToSearchParams(filters);
  if (view === "mapa") sp.set("vista", "mapa");
  return sp;
}
