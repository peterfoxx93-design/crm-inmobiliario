"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase, getUser } from "@/lib/supabase/server";
import {
  rescheduleTaskSchema,
  taskIdSchema,
  updateTaskSchema,
} from "@/lib/validators/task";

/**
 * Server actions de tareas (Task 14). Mismo contrato que actions/deals y
 * actions/contacts: resultados tipados ActionResult<T>, sin throws crudos
 * al cliente, agencia SIEMPRE desde el perfil del actor (impersonacion
 * incluida) y filtro explicito por agency_id en todas las escrituras.
 *
 * Las tareas son activities con type='tarea' (due_date/completed_at).
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
    console.error("[actions/tasks] error inesperado:", error);
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

/** Comprueba que la actividad existe, es una tarea y pertenece a la agencia. */
async function requireTask(
  supabase: Supabase,
  taskId: string,
  agencyId: string,
): Promise<void> {
  const { data } = await supabase
    .from("activities")
    .select("id")
    .eq("id", taskId)
    .eq("type", "tarea")
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!data) throw new ActionError("Tarea no encontrada.");
}

// Helpers locales minimos (mismo patron requireDeal): los equivalentes de
// actions/contacts.ts son privados de su modulo "use server" y no se pueden
// importar entre ficheros de actions.

async function requireContact(
  supabase: Supabase,
  contactId: string,
  agencyId: string,
): Promise<void> {
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!data) throw new ActionError("Contacto no encontrado.");
}

async function requireProperty(
  supabase: Supabase,
  propertyId: string,
  agencyId: string,
): Promise<void> {
  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!data) throw new ActionError("Propiedad no encontrada.");
}

/** Marca una tarea como completada (completed_at = ahora). */
export async function completeTask(id: string): Promise<
  ActionResult<{ id: string; completedAt: string }>
> {
  return runAction(async () => {
    const taskId = taskIdSchema.parse(id);
    const { agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireTask(supabase, taskId, agencyId);

    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from("activities")
      .update({ completed_at: completedAt })
      .eq("id", taskId)
      .eq("agency_id", agencyId);

    if (error) throw new ActionError("No se ha podido completar la tarea.");

    revalidatePath("/agenda");
    return { id: taskId, completedAt };
  });
}

/** Reabre una tarea completada (completed_at = null). */
export async function uncompleteTask(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const taskId = taskIdSchema.parse(id);
    const { agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireTask(supabase, taskId, agencyId);

    const { error } = await supabase
      .from("activities")
      .update({ completed_at: null })
      .eq("id", taskId)
      .eq("agency_id", agencyId);

    if (error) throw new ActionError("No se ha podido reabrir la tarea.");

    revalidatePath("/agenda");
    return { id: taskId };
  });
}

/** Reprograma el vencimiento de una tarea (due_date). */
export async function rescheduleTask(
  id: string,
  dueDate: string,
): Promise<ActionResult<{ id: string; dueDate: string }>> {
  return runAction(async () => {
    const taskId = taskIdSchema.parse(id);
    const data = rescheduleTaskSchema.parse({ dueDate });
    const { agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireTask(supabase, taskId, agencyId);

    const { error } = await supabase
      .from("activities")
      .update({ due_date: data.dueDate })
      .eq("id", taskId)
      .eq("agency_id", agencyId);

    if (error) throw new ActionError("No se ha podido reprogramar la tarea.");

    revalidatePath("/agenda");
    return { id: taskId, dueDate: data.dueDate };
  });
}

/**
 * Edicion parcial desde el TaskDialog. undefined = no tocar;
 * null en contactId/propertyId desvincula; notes mapea a body.
 */
export async function updateTask(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const taskId = taskIdSchema.parse(id);
    const data = updateTaskSchema.parse(input);
    const { agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireTask(supabase, taskId, agencyId);

    // Pertenencia de las entidades referenciadas (solo si se vinculan).
    if (data.contactId) await requireContact(supabase, data.contactId, agencyId);
    if (data.propertyId) await requireProperty(supabase, data.propertyId, agencyId);

    const row: Record<string, unknown> = {};
    if (data.title !== undefined) row.title = data.title;
    if (data.dueDate !== undefined) row.due_date = data.dueDate;
    if (data.contactId !== undefined) row.contact_id = data.contactId;
    if (data.propertyId !== undefined) row.property_id = data.propertyId;
    if (data.notes !== undefined) row.body = data.notes === "" ? null : data.notes;

    if (Object.keys(row).length === 0) return { id: taskId };

    const { error } = await supabase
      .from("activities")
      .update(row)
      .eq("id", taskId)
      .eq("agency_id", agencyId);

    if (error) throw new ActionError("No se han podido guardar los cambios.");

    revalidatePath("/agenda");
    return { id: taskId };
  });
}
