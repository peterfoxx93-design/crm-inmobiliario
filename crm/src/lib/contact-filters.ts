/**
 * Filtros del listado de contactos (Task 12): parseo desde `searchParams`,
 * serializacion y manipulacion pura. Sin dependencias de React/Supabase.
 */

import { CONTACT_STATUS_META } from "@/lib/constants";
import type { ContactStatus, LeadSource } from "@/lib/types";

/** Contactos por pagina (coherente con propiedades). */
export const CONTACT_PAGE_SIZE = 12;

export interface ContactFilters {
  q?: string;
  status?: ContactStatus;
  source?: LeadSource;
  assigned_to?: string;
  page: number;
}

export type ContactFilterKey = "q" | "status" | "source" | "assigned_to";

type SearchParamsInput = Record<string, string | string[] | undefined>;

const MAX_QUERY_LENGTH = 100;
const SOURCES: LeadSource[] = ["web", "manual", "referido", "portal"];
const STATUSES = Object.keys(CONTACT_STATUS_META) as ContactStatus[];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Convierte searchParams crudos en filtros validados; lo desconocido se
 * descarta sin fallar (mismo contrato que parsePropertyFilters).
 */
export function parseContactFilters(params: SearchParamsInput): ContactFilters {
  const rawQ = firstParam(params.q)?.trim().slice(0, MAX_QUERY_LENGTH);
  const rawPage = Number.parseInt(firstParam(params.page) ?? "", 10);

  const filters: ContactFilters = { page: 1 };
  if (rawQ) filters.q = rawQ;

  const status = firstParam(params.status);
  if (status && (STATUSES as string[]).includes(status)) {
    filters.status = status as ContactStatus;
  }
  const source = firstParam(params.source);
  if (source && SOURCES.includes(source as LeadSource)) {
    filters.source = source as LeadSource;
  }
  const assigned = firstParam(params.assigned_to);
  // UUID v4 aproximado: evita inyectar basura en .eq().
  if (
    assigned &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assigned)
  ) {
    filters.assigned_to = assigned;
  }

  if (Number.isFinite(rawPage) && rawPage >= 1) filters.page = rawPage;
  return filters;
}

/** Serializa filtros a querystring omitiendo vacios y page=1. */
export function contactFiltersToSearchParams(
  filters: ContactFilters,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.status) sp.set("status", filters.status);
  if (filters.source) sp.set("source", filters.source);
  if (filters.assigned_to) sp.set("assigned_to", filters.assigned_to);
  if (filters.page > 1) sp.set("page", String(filters.page));
  return sp;
}

/** Copia sin las claves indicadas, reiniciando a pagina 1. */
export function withoutContactFilters(
  filters: ContactFilters,
  keys: readonly ContactFilterKey[],
): ContactFilters {
  const next: ContactFilters = { ...filters };
  for (const key of keys) delete next[key];
  next.page = 1;
  return next;
}

/** true si hay algun filtro activo ademas de la paginacion. */
export function hasActiveContactFilters(filters: ContactFilters): boolean {
  return (
    Boolean(filters.q) ||
    Boolean(filters.status) ||
    Boolean(filters.source) ||
    Boolean(filters.assigned_to)
  );
}
