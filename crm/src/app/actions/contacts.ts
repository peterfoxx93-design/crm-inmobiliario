"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerSupabase, getUser } from "@/lib/supabase/server";
import {
  contactSchema,
  contactUpdateSchema,
} from "@/lib/validators/contact";

/**
 * Server actions de contactos (Task 12). Mismo contrato que actions/properties:
 * resultados tipados, sin throws crudos, agencia SIEMPRE desde el perfil del
 * actor y filtro explicito por agency_id (impersonacion safe).
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const idSchema = z.string().uuid("Identificador no válido.");

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
    console.error("[actions/contacts] error inesperado:", error);
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

function toContactRow(data: ReturnType<typeof normalizeContactInput>) {
  return {
    full_name: data.full_name,
    contact_type: data.contact_type,
    phone: data.phone,
    email: data.email ? data.email : null,
    source: data.source,
    status: data.status,
    budget_max: data.budget_max ?? null,
    preferences: { zones: data.preferred_zones },
    notes: data.notes ? data.notes : null,
    consent_rgpd: data.consent_rgpd,
    consent_at: data.consent_rgpd ? new Date().toISOString() : null,
  };
}

/** Normaliza la salida del schema (email/notas vacios a undefined). */
function normalizeContactInput(input: unknown) {
  return contactSchema.parse(input);
}

/** Crea un contacto en la agencia del actor. */
export async function createContact(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = normalizeContactInput(input);
    const { userId, agencyId } = await resolveActor();
    const supabase = await createServerSupabase();

    const row = toContactRow(data);
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({ ...row, agency_id: agencyId, created_by: userId })
      .select("id")
      .single();

    if (error || !created) {
      throw new ActionError("No se ha podido crear el contacto.");
    }

    // Actividad de sistema: traza la alta del lead.
    await supabase.from("activities").insert({
      agency_id: agencyId,
      contact_id: created.id,
      type: "sistema",
      title: "Contacto creado",
      created_by: userId,
    });

    revalidatePath("/contactos");
    return { id: created.id as string };
  });
}

/** Actualiza el perfil editable inline del drawer. */
export async function updateContact(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const contactId = idSchema.parse(id);
    const data = contactUpdateSchema.parse(input);
    const { agencyId } = await resolveActor();
    const supabase = await createServerSupabase();
    await requireContact(supabase, contactId, agencyId);

    const row: Record<string, unknown> = {};
    if (data.full_name !== undefined) row.full_name = data.full_name;
    if (data.contact_type !== undefined) row.contact_type = data.contact_type;
    if (data.phone !== undefined) row.phone = data.phone;
    if (data.email !== undefined) row.email = data.email === "" ? null : data.email;
    if (data.source !== undefined) row.source = data.source;
    if (data.status !== undefined) row.status = data.status;
    if (data.budget_max !== undefined) row.budget_max = data.budget_max ?? null;
    if (data.preferred_zones !== undefined) {
      row.preferences = { zones: data.preferred_zones };
    }
    if (data.notes !== undefined) row.notes = data.notes === "" ? null : data.notes;
    if (data.consent_rgpd !== undefined) {
      row.consent_rgpd = data.consent_rgpd;
      row.consent_at = data.consent_rgpd ? new Date().toISOString() : null;
    }

    const { error } = await supabase
      .from("contacts")
      .update(row)
      .eq("id", contactId)
      .eq("agency_id", agencyId);
    if (error) throw new ActionError("No se ha podido actualizar el contacto.");

    revalidatePath("/contactos");
    return { id: contactId };
  });
}

// --- Actividades ---

const activityTypes = ["llamada", "email", "whatsapp", "nota", "visita", "tarea"] as const;

const addActivitySchema = z.object({
  type: z.enum(activityTypes, {
    errorMap: () => ({ message: "Tipo de actividad inválido." }),
  }),
  title: z
    .string({ required_error: "El título es obligatorio." })
    .trim()
    .min(1, "El título es obligatorio.")
    .max(160, "El título no puede superar 160 caracteres."),
  body: z.string().trim().max(4000).optional().or(z.literal("")),
  contactId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  /** Fecha `YYYY-MM-DD` (composer, a medianoche) o instante ISO completo
   * (TaskDialog de la Agenda, Task 14); timestamptz acepta ambos. */
  dueDate: z
    .string()
    .refine(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
      "La fecha no es válida.",
    )
    .optional(),
});

export type AddActivityInput = z.infer<typeof addActivitySchema>;

/**
 * Registra una actividad manual (llamada/email/whatsapp/nota/visita/tarea).
 * Verifica que las entidades referenciadas pertenecen a la agencia.
 */
export async function addActivity(
  input: AddActivityInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = addActivitySchema.parse(input);
    const { userId, agencyId } = await resolveActor();
    const supabase = await createServerSupabase();

    if (data.contactId) await requireContact(supabase, data.contactId, agencyId);
    if (data.propertyId) await requireProperty(supabase, data.propertyId, agencyId);
    if (data.dealId) await requireDeal(supabase, data.dealId, agencyId);

    const { data: created, error } = await supabase
      .from("activities")
      .insert({
        agency_id: agencyId,
        type: data.type,
        title: data.title,
        body: data.body ? data.body : null,
        contact_id: data.contactId ?? null,
        property_id: data.propertyId ?? null,
        deal_id: data.dealId ?? null,
        due_date: data.dueDate ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new ActionError("No se ha podido registrar la actividad.");
    }

    revalidatePath("/contactos");
    if (data.propertyId) revalidatePath(`/propiedades/${data.propertyId}`);
    if (data.dealId) revalidatePath("/pipeline");
    // Las tareas viven en la Agenda (Task 14).
    if (data.type === "tarea") revalidatePath("/agenda");
    return { id: created.id as string };
  });
}

// --- Ofertas (deals) ---

const createOfferSchema = z.object({
  contactId: z.string().uuid("Contacto inválido."),
  propertyId: z.string().uuid("Propiedad inválida."),
  value: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ invalid_type_error: "El importe debe ser un número." })
      .positive("El importe debe ser mayor que cero."),
  ),
});

/**
 * Crea una oferta: deal en etapa nuevo_lead + activity 'sistema'
 * "Oferta creada" que une contacto, propiedad y deal (Task 12).
 */
export async function createOffer(
  input: unknown,
): Promise<ActionResult<{ dealId: string }>> {
  return runAction(async () => {
    const data = createOfferSchema.parse(input);
    const { userId, agencyId } = await resolveActor();
    const supabase = await createServerSupabase();

    await requireContact(supabase, data.contactId, agencyId);
    await requireProperty(supabase, data.propertyId, agencyId);

    const { data: deal, error } = await supabase
      .from("deals")
      .insert({
        agency_id: agencyId,
        contact_id: data.contactId,
        property_id: data.propertyId,
        agent_id: userId,
        stage: "nuevo_lead",
        value: data.value,
      })
      .select("id")
      .single();

    if (error || !deal) {
      throw new ActionError("No se ha podido crear la oferta.");
    }

    await supabase.from("activities").insert({
      agency_id: agencyId,
      contact_id: data.contactId,
      property_id: data.propertyId,
      deal_id: deal.id as string,
      type: "sistema",
      title: "Oferta creada",
      body: `Importe: ${data.value} EUR`,
      created_by: userId,
    });

    revalidatePath("/pipeline");
    revalidatePath("/contactos");
    return { dealId: deal.id as string };
  });
}
