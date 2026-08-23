import "server-only";

import {
  PROPERTY_PAGE_SIZE,
  type PropertyFilters,
} from "@/lib/property-filters";
import { sanitizeSearchTerm } from "@/lib/search";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Property, PropertyImage } from "@/lib/types";

/** Imagenes embebidas en el select (solo url/position, como pide el brief). */
export type PropertyImageRow = Pick<PropertyImage, "url" | "position">;

export interface PropertyWithImages extends Property {
  property_images: PropertyImageRow[];
}

export interface PropertyListResult {
  properties: PropertyWithImages[];
  /** Total de filas que cumplen los filtros (para paginacion). */
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Lista propiedades con filtros y paginacion servidor (12/pag, Task 9).
 * RLS aísla la agencia automaticamente via `agency_id` del JWT.
 *
 * Lanza si la consulta falla (p. ej. sin red); la pagina lo captura y muestra
 * un EmptyState amable en lugar de romper la vista.
 */
export async function listProperties(
  filters: PropertyFilters,
): Promise<PropertyListResult> {
  const supabase = await createServerSupabase();

  const page = Math.max(1, Math.floor(filters.page));
  const from = (page - 1) * PROPERTY_PAGE_SIZE;
  const to = from + PROPERTY_PAGE_SIZE - 1;

  let query = supabase
    .from("properties")
    .select("*, property_images(url, position)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  // Sanitizamos SIEMPRE antes de interpolar en `.or()` (PostgREST reserva
  // `,()"%` y `%`/`_` son comodines de ilike).
  const q = filters.q ? sanitizeSearchTerm(filters.q) : "";
  if (q) {
    query = query.or(
      `title.ilike.%${q}%,reference.ilike.%${q}%,city.ilike.%${q}%`,
    );
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.operation) query = query.eq("operation", filters.operation);
  if (filters.property_type) query = query.eq("property_type", filters.property_type);
  if (typeof filters.priceMin === "number") query = query.gte("price", filters.priceMin);
  if (typeof filters.priceMax === "number") query = query.lte("price", filters.priceMax);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`No se han podido cargar las propiedades: ${error.message}`);
  }

  const total = count ?? 0;
  const properties = (data ?? []).map((row) => ({
    ...(row as Property),
    property_images: [...((row as { property_images?: PropertyImageRow[] }).property_images ?? [])].sort(
      (a, b) => a.position - b.position,
    ),
  }));

  return {
    properties,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PROPERTY_PAGE_SIZE)),
  };
}
