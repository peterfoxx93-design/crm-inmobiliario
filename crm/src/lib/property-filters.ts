/**
 * Filtros del listado de propiedades (Task 9): parseo desde `searchParams`,
 * serializacion de vuelta a querystring y manipulacion pura de filtros.
 * Sin dependencias de React ni Supabase para poder testearlos en node.
 */

import { OPERATION_LABELS, PROPERTY_STATUS_META, PROPERTY_TYPES } from "@/lib/constants";
import type { OperationType, PropertyStatus, PropertyType } from "@/lib/types";

/** Propiedades por pagina en el listado (restriccion global del MVP). */
export const PROPERTY_PAGE_SIZE = 12;

export interface PropertyFilters {
  /** Busqueda libre por titulo/referencia/ciudad. */
  q?: string;
  status?: PropertyStatus;
  operation?: OperationType;
  property_type?: PropertyType;
  priceMin?: number;
  priceMax?: number;
  /** Pagina 1-indexada; siempre presente tras el parseo. */
  page: number;
}

/** Claves removibles de PropertyFilters (excluye `page`). */
export type PropertyFilterKey =
  | "q"
  | "status"
  | "operation"
  | "property_type"
  | "priceMin"
  | "priceMax";

type SearchParamsInput = Record<string, string | string[] | undefined>;

const MAX_QUERY_LENGTH = 100;

// Listas permitidas derivadas de la unica fuente de verdad (constants/types).
const STATUSES = Object.keys(PROPERTY_STATUS_META) as PropertyStatus[];
const OPERATIONS = Object.keys(OPERATION_LABELS) as OperationType[];
const TYPES = PROPERTY_TYPES.map((t) => t.id);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseEnumValue<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function parsePrice(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

/**
 * Convierte los searchParams crudos de Next (`Promise<Record<string, string |
 * string[] | undefined>>` ya resuelto) en filtros validados e inocuos.
 * Los valores desconocidos se descartan en lugar de fallar.
 */
export function parsePropertyFilters(params: SearchParamsInput): PropertyFilters {
  const rawQ = firstParam(params.q)?.trim().slice(0, MAX_QUERY_LENGTH);
  const rawPage = Number.parseInt(firstParam(params.page) ?? "", 10);

  const filters: PropertyFilters = { page: 1 };
  if (rawQ) filters.q = rawQ;
  if (Number.isFinite(rawPage) && rawPage >= 1) filters.page = rawPage;

  filters.status = parseEnumValue(firstParam(params.status), STATUSES);
  filters.operation = parseEnumValue(firstParam(params.operation), OPERATIONS);
  filters.property_type = parseEnumValue(firstParam(params.property_type), TYPES);
  filters.priceMin = parsePrice(firstParam(params.priceMin));
  filters.priceMax = parsePrice(firstParam(params.priceMax));

  return filters;
}

/**
 * Serializa filtros a URLSearchParams para construir hrefs y `router.push`.
 * Omite vacios y `page=1`; el orden es estable.
 */
export function filtersToSearchParams(filters: PropertyFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.status) sp.set("status", filters.status);
  if (filters.operation) sp.set("operation", filters.operation);
  if (filters.property_type) sp.set("property_type", filters.property_type);
  if (typeof filters.priceMin === "number") sp.set("priceMin", String(filters.priceMin));
  if (typeof filters.priceMax === "number") sp.set("priceMax", String(filters.priceMax));
  if (filters.page > 1) sp.set("page", String(filters.page));
  return sp;
}

/**
 * Devuelve copia sin las claves indicadas, reiniciando a la pagina 1
 * (cualquier cambio de filtro invalida la paginacion actual). No muta `filters`.
 */
export function withoutPropertyFilters(
  filters: PropertyFilters,
  keys: readonly PropertyFilterKey[],
): PropertyFilters {
  const next: PropertyFilters = { ...filters };
  for (const key of keys) {
    delete next[key];
  }
  next.page = 1;
  return next;
}

/** true si hay algun filtro activo ademas de la paginacion. */
export function hasActivePropertyFilters(filters: PropertyFilters): boolean {
  return (
    Boolean(filters.q) ||
    Boolean(filters.status) ||
    Boolean(filters.operation) ||
    Boolean(filters.property_type) ||
    typeof filters.priceMin === "number" ||
    typeof filters.priceMax === "number"
  );
}
