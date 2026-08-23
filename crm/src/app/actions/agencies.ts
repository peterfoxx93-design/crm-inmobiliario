"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { closeOpenImpersonationLogs } from "@/lib/admin-users";
import {
  resolveMaestroActor,
  resolveSuperAdminActor,
} from "@/lib/maestro-server";
import {
  impersonationStartError,
  impersonationStopError,
} from "@/lib/master-access";
import { slugify } from "@/lib/slug";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AgencySettings } from "@/lib/types";
import {
  upsertAgencyInputSchema,
  type UpsertAgencyInput,
} from "@/lib/validators/agency";

/**
 * Server actions del panel maestro (Task 17). Mismo contrato que
 * actions/deals y actions/my-agency: resultados tipados ActionResult<T>,
 * sin throws crudos al cliente.
 *
 * Seguridad (superficie de mayor riesgo de la app):
 * - TODA accion arranca con resolveMaestroActor(): sesion + super_admin +
 *   sin suplantacion activa (guard puro de lib/master-access.ts).
 * - Las escrituras en `agencies` y `profiles.active_agency_id` van por el
 *   cliente SSR con RLS: agency_write_super_admin y profiles_update_self ya
 *   lo permiten para un super_admin (el trigger guard_profile_privilege_
 *   escalation NO bloquea a super_admin), asi que aqui no hace falta
 *   service_role. La UNICA excepcion es cerrar `impersonation_logs.ended_at`
 *   (tabla inmutable por RLS): se hace via closeOpenImpersonationLogs
 *   (service_role) SOLO tras el guard — patron Task 6/16.
 * - Orden de impersonateStart deliberado: 1) update del perfil,
 *   2) INSERT del log; si el log falla se revierte el perfil (best-effort).
 *   Al reves dejaria un log abierto imposible de cerrar desde cliente
 *   (sin policy DELETE) si el update fallara.
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
    // Errores de dominio (guards/lib) traen mensaje util en espanol.
    if (error instanceof Error && error.message) {
      return { ok: false, error: error.message };
    }
    console.error("[actions/agencies] error inesperado:", error);
    return {
      ok: false,
      error: "Se ha producido un error inesperado. Inténtalo de nuevo.",
    };
  }
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/**
 * Garantiza un slug unico. Base = slug manual validado o slugify(name);
 * si esta cogido anade sufijos -2, -3... Comprueba contra TODAS las agencias
 * (un super_admin las ve todas por RLS).
 */
async function ensureUniqueSlug(
  supabase: Supabase,
  base: string,
  excludeId?: string,
): Promise<string> {
  const fallback = base || "agencia";
  const { data: rows, error } = await supabase.from("agencies").select("id, slug");
  if (error || !rows) {
    throw new ActionError("No se han podido comprobar los identificadores existentes.");
  }
  const taken = new Set(
    rows.filter((r) => r.id !== excludeId).map((r) => r.slug as string),
  );
  if (!taken.has(fallback)) return fallback;
  for (let n = 2; ; n += 1) {
    const candidate = `${fallback}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Compone agencies.settings preservando claves desconocidas previas. */
function buildSettings(
  current: AgencySettings | null,
  input: UpsertAgencyInput,
): AgencySettings {
  const next: AgencySettings = { ...(current ?? {}) };
  if (input.slaLeadHours !== undefined) next.sla_lead_hours = input.slaLeadHours;
  if (input.pipelineStageDays !== undefined) {
    next.pipeline_stage_days = input.pipelineStageDays;
  }
  if (input.webForm !== undefined) next.web_form = input.webForm;
  return next;
}

/** Crea o edita una agencia (branding + settings). Solo super_admin. */
export async function upsertAgency(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAction(async () => {
    await resolveMaestroActor();
    const data = upsertAgencyInputSchema.parse(input);
    const supabase = await createServerSupabase();

    const patch: Record<string, unknown> = {
      name: data.name,
      primary_color: data.color,
    };
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;

    if (data.id) {
      // --- Edicion ---
      const { data: existing, error: fetchError } = await supabase
        .from("agencies")
        .select("id, slug, settings")
        .eq("id", data.id)
        .maybeSingle();
      if (fetchError || !existing) {
        throw new ActionError("La agencia no existe.");
      }

      const slug = data.slug
        ? await ensureUniqueSlug(supabase, data.slug, data.id)
        : existing.slug as string;
      patch.slug = slug;
      patch.settings = buildSettings(
        (existing.settings as AgencySettings | null) ?? null,
        data,
      );

      const { error } = await supabase
        .from("agencies")
        .update(patch)
        .eq("id", data.id);
      if (error) {
        throw new ActionError("No se han podido guardar los cambios de la agencia.");
      }

      revalidatePath("/maestro");
      revalidatePath("/", "layout");
      return { id: data.id, slug };
    }

    // --- Alta ---
    const slug = await ensureUniqueSlug(
      supabase,
      data.slug ?? slugify(data.name),
    );
    patch.slug = slug;
    patch.settings = buildSettings(null, data);

    const { data: created, error } = await supabase
      .from("agencies")
      .insert(patch)
      .select("id")
      .single();
    if (error || !created) {
      throw new ActionError("No se ha podido crear la agencia.");
    }

    revalidatePath("/maestro");
    return { id: created.id as string, slug };
  });
}

/**
 * Activa o desactiva una agencia. Desactivada => get_public_branding deja de
 * devolver fila => su login queda bloqueado (ademas del gate servidor del
 * layout). Solo super_admin.
 */
export async function toggleAgencyActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string; active: boolean }>> {
  return runAction(async () => {
    await resolveMaestroActor();
    const agencyId = z.string().uuid("Identificador de agencia no válido.").parse(id);

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("agencies")
      .update({ active })
      .eq("id", agencyId);

    if (error) {
      throw new ActionError(
        active
          ? "No se ha podido activar la agencia."
          : "No se ha podido desactivar la agencia.",
      );
    }

    revalidatePath("/maestro");
    revalidatePath("/", "layout");
    return { id: agencyId, active };
  });
}

/**
 * Entra como administrador de la agencia: fija profiles.active_agency_id e
 * inserta el registro de auditoria (impersonation_logs). Solo super_admin
 * sin otra suplantacion activa (inicio doble rechazado, sin auto-stop).
 */
export async function impersonateStart(
  agencyId: string,
): Promise<ActionResult<{ impersonating: true }>> {
  return runAction(async () => {
    const actor = await resolveSuperAdminActor();
    const targetId = z.string().uuid("Identificador de agencia no válido.").parse(agencyId);

    const supabase = await createServerSupabase();

    // El destino puede existir activo o desactivado (soporte/diagnostico).
    const { data: target } = await supabase
      .from("agencies")
      .select("id, active")
      .eq("id", targetId)
      .maybeSingle();

    const guardError = impersonationStartError(
      actor,
      target ? { id: target.id, active: Boolean(target.active) } : null,
    );
    if (guardError) throw new ActionError(guardError);

    // 1) Contexto efectivo: coalesce(active_agency_id, agency_id) manda en
    //    todas las queries RLS de negocio (get_my_agency_id).
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ active_agency_id: targetId })
      .eq("id", actor.userId);
    if (profileError) {
      throw new ActionError("No se ha podido iniciar la suplantación.");
    }

    // 2) Auditoria. Si falla, revertimos el paso 1 (best-effort): nunca
    //    suplantar sin registro.
    const { error: logError } = await supabase.from("impersonation_logs").insert({
      super_admin_id: actor.userId,
      target_agency_id: targetId,
    });
    if (logError) {
      await supabase
        .from("profiles")
        .update({ active_agency_id: null })
        .eq("id", actor.userId);
      throw new ActionError("No se ha podido registrar la suplantación.");
    }

    revalidatePath("/", "layout");
    return { impersonating: true as const };
  });
}

/**
 * Sale de la suplantacion: limpia profiles.active_agency_id (null) y cierra
 * el log abierto (ended_at) via service_role tras el guard — la tabla es
 * inmutable para clientes por diseno y no se le anaden policies UPDATE.
 */
export async function impersonateStop(): Promise<ActionResult<{ stopped: true }>> {
  return runAction(async () => {
    const actor = await resolveSuperAdminActor();

    const supabase = await createServerSupabase();

    const guardError = impersonationStopError(actor);
    if (guardError) throw new ActionError(guardError);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ active_agency_id: null })
      .eq("id", actor.userId);
    if (profileError) {
      throw new ActionError("No se ha podido salir de la suplantación.");
    }

    // Cierre de auditoria DESPUES de limpiar el contexto (si esto falla, el
    // siguiente ciclo start/stop lo cerrara: filtra ended_at is null).
    await closeOpenImpersonationLogs(actor.userId);

    revalidatePath("/", "layout");
    return { stopped: true as const };
  });
}
