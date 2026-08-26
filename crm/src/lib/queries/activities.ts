import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { Activity } from "@/lib/types";

/** Actividad con el nombre del autor resuelto (para la timeline). */
export interface ActivityWithAuthor extends Activity {
  author_name: string | null;
}

export interface ActivityScope {
  contactId?: string;
  propertyId?: string;
  dealId?: string;
}

/**
 * Timeline de actividades (Task 12): orden inverso (recientes primero),
 * con autor resuelto en lote para evitar N+1 y sin depender del nombre
 * de la FK de created_by.
 */
export async function listActivities(
  scope: ActivityScope,
  limit = 100,
): Promise<ActivityWithAuthor[]> {
  const supabase = await createServerSupabase();
  const { data: effectiveAgencyId } = await supabase.rpc("get_my_agency_id");

  let query = supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (effectiveAgencyId) query = query.eq("agency_id", effectiveAgencyId as string);

  if (scope.contactId) query = query.eq("contact_id", scope.contactId);
  if (scope.propertyId) query = query.eq("property_id", scope.propertyId);
  if (scope.dealId) query = query.eq("deal_id", scope.dealId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`No se han podido cargar las actividades: ${error.message}`);
  }

  const rows = (data ?? []) as Activity[];
  if (rows.length === 0) return [];

  // Autores unicos de la pagina -> una sola query a profiles.
  const authorIds = [...new Set(rows.map((row) => row.created_by))];
  const { data: authors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", authorIds);

  const names = new Map<string, string>();
  for (const author of (authors ?? []) as Array<{ id: string; full_name: string }>) {
    names.set(author.id, author.full_name);
  }

  return rows.map((row) => ({
    ...row,
    author_name: names.get(row.created_by) ?? null,
  }));
}
