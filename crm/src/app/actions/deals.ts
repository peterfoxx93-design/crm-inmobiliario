"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase, getUser } from "@/lib/supabase/server";
import type { DealStage } from "@/lib/types";
import {
  closeDealSchema,
  dealIdSchema,
  dealStageSchema,
  updateDealSchema,
} from "@/lib/validators/deal";

/**
 * Server actions de ofertas (Task 13). Mismo contrato que actions/contacts:
 * resultados tipados ActionResult<T>, sin throws crudos al cliente,
 * agencia SIEMPRE desde el perfil del actor (active_agency_id ?? agency_id)
 * y filtro explicito por agency_id en todas las escrituras.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

class ActionError extends Error {}

async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ActionError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        error: error.issues[0]?.message ?? "Los datos introducidos no son válidos.",
      };
    }
    console.error("[actions/deals] error inesperado:", error);
    return {
      ok: false,
      error: "Se ha producido un error inesperado. Inténtalo de nuevo.",
    };
  }
}

interface Actor {
  userId: string;
  agencyId: string;
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Resuelve actor autenticado + agencia activa (impersonacion incluida). */
async function resolveActor(): Promise<Actor> {
  const user = await getUser();
  if (!user) throw new ActionError("Debes iniciar sesión.");

  const supabase = await createServerSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("agency_id, active_agency_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) throw new ActionError("No se ha podido verificar tu perfil.");

  const agencyId =
    profile.active_agency_id !== null ? profile.active_agency_id : profile.agency_id;
  if (!agencyId) throw new ActionError("No tienes ninguna agencia activa.");

  return { userId: user.id, agencyId };
}

/** Comprueba que el deal existe dentro de la agencia del actor. */
async function requireDeal(
  supabase: Supabase,
  dealId: string,
  agencyId: string,
): Promise<void> {
  const { data } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!data) throw new ActionError("Oferta no encontrada.");
}

/**
 * Mueve un deal a otra etapa del pipeline y reinicia su contador SLA
 * (stage_updated_at = ahora).
 */
export async function moveDeal(
  id: string,
  stage: string,
): Promise<ActionResult<{ id: string; stage: DealStage }>> {
  return runAction(async () => {
    const dealId = dealIdSchema.parse(id);
    const nextStage = dealStageSchema.parse(stage);
    const { agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireDeal(supabase, dealId, agencyId);

    const { error } = await supabase
      .from("deals")
      .update({
        stage: nextStage,
        stage_updated_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .eq("agency_id", agencyId);

    if (error) throw new ActionError("No se ha podido mover la oferta.");

    revalidatePath("/pipeline");
    return { id: dealId, stage: nextStage };
  });
}

/** Actualiza notas e importe del deal desde el drawer (parcial). */
export async function updateDeal(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const dealId = dealIdSchema.parse(id);
    const data = updateDealSchema.parse(input);
    const { agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireDeal(supabase, dealId, agencyId);

    const row: Record<string, unknown> = {};
    if (data.notes !== undefined) row.notes = data.notes === "" ? null : data.notes;
    if (data.value !== undefined) row.value = data.value;

    const { error } = await supabase
      .from("deals")
      .update(row)
      .eq("id", dealId)
      .eq("agency_id", agencyId);

    if (error) throw new ActionError("No se han podido guardar los cambios.");

    revalidatePath("/pipeline");
    return { id: dealId };
  });
}

/**
 * Cierra un deal como ganado o perdido. El estado de la propiedad NO se
 * toca aqui: la sugerencia de marcarla vendida vive en la UI del drawer
 * y llama a setPropertyStatus (unica fuente de verdad para properties.status).
 */
export async function closeDeal(
  id: string,
  won: boolean,
  lostReason?: string,
): Promise<ActionResult<{ id: string; won: boolean }>> {
  return runAction(async () => {
    const dealId = dealIdSchema.parse(id);
    const data = closeDealSchema.parse({ won, lostReason });
    if (!data.won && !data.lostReason) {
      throw new ActionError("Indica el motivo de la pérdida.");
    }

    const { userId, agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireDeal(supabase, dealId, agencyId);

    const { error } = await supabase
      .from("deals")
      .update({
        won: data.won,
        // El motivo solo aplica a perdidas; en ganado se limpia por si hubo draft previo.
        lost_reason: data.won ? null : (data.lostReason ?? null),
      })
      .eq("id", dealId)
      .eq("agency_id", agencyId);

    if (error) throw new ActionError("No se ha podido cerrar la oferta.");

    // Auditoria best-effort para la timeline (patron setPropertyStatus).
    const activityError = await supabase.from("activities").insert({
      agency_id: agencyId,
      contact_id: null,
      property_id: null,
      deal_id: dealId,
      type: "sistema",
      title: data.won ? "Oferta ganada" : "Oferta perdida",
      body: data.won ? null : `Motivo: ${data.lostReason}`,
      created_by: userId,
    });
    if (activityError.error) {
      console.error(
        "[actions/deals] no se pudo auditar el cierre:",
        activityError.error.message,
      );
    }

    revalidatePath("/pipeline");
    return { id: dealId, won: data.won };
  });
}
