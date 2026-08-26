import "server-only";

import {
  PROPERTY_PAGE_SIZE,
  type PropertyFilters,
} from "@/lib/property-filters";
import { sanitizeSearchTerm } from "@/lib/search";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Activity, Property, PropertyImage } from "@/lib/types";

/** Imagenes embebidas en el select del listado (solo url/position, Task 9). */
export type PropertyImageRow = Pick<PropertyImage, "url" | "position">;

/** Imagenes completas de la ficha (id/url/position, Task 10). */
export type PropertyImageFull = Pick<PropertyImage, "id" | "url" | "position">;

export interface PropertyWithImages extends Property {
  property_images: PropertyImageRow[];
}

export interface PropertyDetail extends Property {
  property_images: PropertyImageFull[];
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
  // Impersonación: super_admin con active_agency_id debe ver solo esa agencia (RLS actual permite todo por is_super_admin)
  const { data: effectiveAgencyId } = await supabase.rpc("get_my_agency_id");

  const page = Math.max(1, Math.floor(filters.page));
  const from = (page - 1) * PROPERTY_PAGE_SIZE;
  const to = from + PROPERTY_PAGE_SIZE - 1;

  let query = supabase
    .from("properties")
    .select("*, property_images(url, position)", { count: "exact" })
    // Deuda T9 saldada: `id` como tiebreaker para que filas con el mismo
    // created_at (inserciones en lote) mantengan un orden estable entre paginas.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
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
  if (effectiveAgencyId) query = query.eq("agency_id", effectiveAgencyId as string);

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

/**
 * Detalle completo de una propiedad para la ficha (Task 10), con todas
 * sus imagenes (id/url/position) ordenadas por `position`.
 * Devuelve null si no existe o no es visible (RLS); lanza si falla la red.
 */
export async function getPropertyDetail(
  id: string,
): Promise<PropertyDetail | null> {
  const supabase = await createServerSupabase();
  const { data: effectiveAgencyId } = await supabase.rpc("get_my_agency_id");

  const { data, error } = await supabase
    .from("properties")
    .select("*, property_images(id, url, position)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se ha podido cargar la propiedad: ${error.message}`);
  }
  if (!data) return null;
  if (effectiveAgencyId && (data as Property).agency_id !== (effectiveAgencyId as string)) return null;

  return {
    ...(data as Property),
    property_images: (
      ((data as { property_images?: PropertyImageFull[] }).property_images ?? [])
    ).sort((a, b) => a.position - b.position),
  };
}

/**
 * Timeline de actividades de una propiedad (Task 10, tab Visitas).
 * Orden cronologico ascendente; se rellena desde Task 12 y con las
 * auditorias tipo 'sistema' de los cambios de estado.
 */
export async function listPropertyActivities(
  propertyId: string,
): Promise<Activity[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`No se han podido cargar las actividades: ${error.message}`);
  }

  return (data ?? []) as Activity[];
}

/** Opciones ligeras para selects (dialogo de oferta, Task 12). */
export async function listPropertyOptions(): Promise<
  Array<{ id: string; title: string; reference: string }>
> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("properties")
    .select("id, title, reference")
    .neq("status", "retirado")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return [];
  return (data ?? []) as Array<{ id: string; title: string; reference: string }>;
}
