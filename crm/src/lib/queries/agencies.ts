import "server-only";

import { resolveMaestroActor } from "@/lib/maestro-server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Agency } from "@/lib/types";

/**
 * Lecturas del panel maestro (Task 17) — SOLO SERVIDOR.
 * El conteo por agencia (usuarios, propiedades, contactos, ofertas) se hace
 * en memoria sobre lecturas RLS: un super_admin ve TODAS las filas (policy
 * agency_isolation con is_super_admin), asi que no hace falta RPC ni SQL
 * crudo. Volumen MVP asumido pequeno; si crece, migrar a una view/RPC con
 * count() agrupado en servidor de base de datos.
 */

export interface AgencyCounts {
  users: number;
  properties: number;
  contacts: number;
  deals: number;
}

export interface AgencyMasterRow {
  agency: Agency;
  counts: AgencyCounts;
}

/** Cuenta filas por agency_id en un Map auxiliar. */
function tally(rows: Array<{ agency_id: string | null } | null>): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row?.agency_id;
    if (!id) continue; // super_admin sin agencia, hueros, etc.
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

/**
 * Lista todas las agencias con sus conteos. Lanza error si el llamador no es
 * super_admin sin suplantacion activa (mismo guard que las acciones).
 */
export async function listAgenciesWithCounts(): Promise<AgencyMasterRow[]> {
  await resolveMaestroActor();
  const supabase = await createServerSupabase();

  const [agenciesRes, profilesRes, propertiesRes, contactsRes, dealsRes] =
    await Promise.all([
      supabase.from("agencies").select("*").order("name", { ascending: true }),
      supabase.from("profiles").select("agency_id"),
      supabase.from("properties").select("agency_id"),
      supabase.from("contacts").select("agency_id"),
      supabase.from("deals").select("agency_id"),
    ]);

  if (agenciesRes.error || !agenciesRes.data) {
    throw new Error("No se han podido cargar las agencias.");
  }

  // Los conteos son best-effort: una tabla vacia o ilegible cuenta 0 y se
  // registra, nunca rompe el panel.
  if (profilesRes.error) console.error("[queries/agencies] profiles:", profilesRes.error.message);
  if (propertiesRes.error) console.error("[queries/agencies] properties:", propertiesRes.error.message);
  if (contactsRes.error) console.error("[queries/agencies] contacts:", contactsRes.error.message);
  if (dealsRes.error) console.error("[queries/agencies] deals:", dealsRes.error.message);

  const users = tally(profilesRes.data ?? []);
  const properties = tally(propertiesRes.data ?? []);
  const contacts = tally(contactsRes.data ?? []);
  const deals = tally(dealsRes.data ?? []);

  return agenciesRes.data.map((row) => {
    const agency = row as Agency;
    const id = agency.id;
    return {
      agency,
      counts: {
        users: users.get(id) ?? 0,
        properties: properties.get(id) ?? 0,
        contacts: contacts.get(id) ?? 0,
        deals: deals.get(id) ?? 0,
      },
    };
  });
}
