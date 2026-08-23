import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AgencySettings, DealStage } from "@/lib/types";
import type { DealWithRelations } from "@/lib/pipeline";

/**
 * Queries server-only del pipeline (Task 13). La RLS aísla por agencia;
 * el embed de relaciones usa las FK con nombre explícito para que
 * PostgREST no ambigüe cuando haya varias rutas a la misma tabla.
 */

export type { DealWithRelations };

/**
 * Lista los deals ABIERTOS (won IS NULL) de la agencia del actor.
 * Orden: etapa ascendente + mas recientes primero dentro de cada columna.
 */
export async function listDeals(): Promise<DealWithRelations[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("deals")
    .select(
      [
        "*",
        "contact:contacts!deals_contact_id_fkey(full_name)",
        "property:properties!deals_property_id_fkey(id,title,price,property_images(url))",
        "agent:profiles!deals_agent_id_fkey(full_name,avatar_url)",
      ].join(","),
    )
    .is("won", null)
    .order("stage", { ascending: true })
    .order("created_at", { ascending: false })
    // Portada de cada propiedad = imagen de menor posicion.
    .order("position", { ascending: true, referencedTable: "property_images" });

  if (error) {
    throw new Error(`No se ha podido cargar el pipeline: ${error.message}`);
  }

  // Primera imagen de cada propiedad: la de menor posicion (portada).
  const deals = ((data ?? []) as unknown as DealWithRelations[]).map((deal) => ({
    ...deal,
    property: deal.property
      ? {
          ...deal.property,
          property_images: [...(deal.property.property_images ?? [])].slice(0, 1),
        }
      : null,
  }));

  return deals;
}

/**
 * Umbrales SLA por etapa definidos en agencies.settings.pipeline_stage_days.
 * Nunca lanza: sin fila o sin settings devuelve {} (sin alertas SLA).
 */
export async function getAgencyPipelineDays(): Promise<
  Partial<Record<DealStage, number>>
> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profile } = await supabase
    .from("profiles")
    .select("agency_id, active_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  const agencyId =
    profile?.active_agency_id !== null && profile?.active_agency_id !== undefined
      ? profile.active_agency_id
      : (profile?.agency_id ?? null);
  if (!agencyId) return {};

  const { data: agency } = await supabase
    .from("agencies")
    .select("settings")
    .eq("id", agencyId)
    .maybeSingle();

  const settings = agency?.settings as AgencySettings | null | undefined;
  return settings?.pipeline_stage_days ?? {};
}
