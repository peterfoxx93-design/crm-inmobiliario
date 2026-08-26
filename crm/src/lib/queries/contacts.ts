import "server-only";

import {
  CONTACT_PAGE_SIZE,
  type ContactFilters,
} from "@/lib/contact-filters";
import { sanitizeSearchTerm } from "@/lib/search";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Activity, Contact } from "@/lib/types";

/** Agente asignado embebido en el listado (solo lo que pinta la tabla). */
export type AssignedAgent = Pick<
  import("@/lib/types").Profile,
  "id" | "full_name" | "avatar_url"
>;

export interface ContactWithMeta extends Contact {
  assigned_agent: AssignedAgent | null;
  /** ISO de la ultima actividad del contacto; null si nunca tuvo. */
  last_activity_at: string | null;
}

export interface ContactListResult {
  contacts: ContactWithMeta[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Lista contactos con filtros y paginacion servidor (12/pag, Task 12).
 * RLS aísla la agencia; el embed de profiles usa la FK de assigned_to.
 */
export async function listContacts(
  filters: ContactFilters,
): Promise<ContactListResult> {
  const supabase = await createServerSupabase();
  const { data: effectiveAgencyId } = await supabase.rpc("get_my_agency_id");

  const page = Math.max(1, Math.floor(filters.page));
  const from = (page - 1) * CONTACT_PAGE_SIZE;
  const to = from + CONTACT_PAGE_SIZE - 1;

  let query = supabase
    .from("contacts")
    .select(
      "*, assigned_agent:profiles!contacts_assigned_to_fkey(id, full_name, avatar_url)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  const q = filters.q ? sanitizeSearchTerm(filters.q) : "";
  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
    );
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (effectiveAgencyId) query = query.eq("agency_id", effectiveAgencyId as string);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`No se han podido cargar los contactos: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as Array<
    Contact & { assigned_agent: AssignedAgent | null }
  >;
  const contacts = await attachLastActivity(rows);

  return {
    contacts,
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / CONTACT_PAGE_SIZE)),
  };
}

/**
 * Anade `last_activity_at` por contacto con una sola query extra sobre
 * las actividades de la pagina actual (PostgREST no hace GROUP BY).
 */
async function attachLastActivity(
  rows: Array<Contact & { assigned_agent: AssignedAgent | null }>,
): Promise<ContactWithMeta[]> {
  if (rows.length === 0) return [];

  const supabase = await createServerSupabase();
  const ids = rows.map((row) => row.id);
  const { data: activities } = await supabase
    .from("activities")
    .select("contact_id, created_at")
    .in("contact_id", ids)
    .order("created_at", { ascending: false })
    .limit(500);

  const lastByContact = new Map<string, string>();
  for (const activity of (activities ?? []) as Pick<Activity, "contact_id" | "created_at">[]) {
    // La query viene descendente: la primera aparicion es la mas reciente.
    if (
      activity.contact_id &&
      !lastByContact.has(activity.contact_id)
    ) {
      lastByContact.set(activity.contact_id, activity.created_at);
    }
  }

  return rows.map((row) => ({
    ...row,
    last_activity_at: lastByContact.get(row.id) ?? null,
  }));
}

/** Detalle completo de un contacto para el drawer 360. Null si invisible. */
export async function getContactDetail(
  id: string,
): Promise<(Contact & { assigned_agent: AssignedAgent | null }) | null> {
  const supabase = await createServerSupabase();
  const { data: effectiveAgencyId } = await supabase.rpc("get_my_agency_id");

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "*, assigned_agent:profiles!contacts_assigned_to_fkey(id, full_name, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`No se ha podido cargar el contacto: ${error.message}`);
  }
  if (!data) return null;
  if (effectiveAgencyId && (data as Contact).agency_id !== (effectiveAgencyId as string)) return null;

  return data as Contact & { assigned_agent: AssignedAgent | null };
}

/** Lista ligera de agentes de la agencia (filtro asignado + select oferta). */
export async function listAgencyAgents(): Promise<AssignedAgent[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .order("full_name", { ascending: true });

  if (error) return [];
  return (data ?? []) as AssignedAgent[];
}

/** Opciones ligeras para el combobox de contactos del dialogo de tareas. */
export async function listContactOptions(): Promise<
  Array<{ id: string; full_name: string }>
> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return [];
  return (data ?? []) as Array<{ id: string; full_name: string }>;
}
