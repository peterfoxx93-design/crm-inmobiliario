"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildReference, parseReferenceSeq } from "@/lib/format";
import { computePositions } from "@/lib/gallery";
import {
  sanitizeFileName,
  storagePathFromPublicUrl,
  validateImageFile,
} from "@/lib/image-upload";
import { PROPERTY_STATUS_META } from "@/lib/constants";
import { createServerSupabase, getUser } from "@/lib/supabase/server";
import type { PropertyStatus } from "@/lib/types";
import {
  propertySchema,
  propertyStatusSchema,
  type PropertyInput,
} from "@/lib/validators/property";

/**
 * Server actions de la ficha de propiedad (Task 10).
 *
 * Contrato: TODAS devuelven un resultado tipado `ActionResult` y NUNCA
 * lanzan un error crudo al cliente. La agencia se resuelve SIEMPRE desde
 * el perfil del actor (`active_agency_id ?? agency_id`, igual que
 * get_my_agency_id()) y jamas del input del cliente (enmienda controller).
 * Las queries llevan ademas filtro explicito por `agency_id` para que la
 * impersonacion de super_admin no cruce datos entre agencias.
 */

/** Resultado tipado de las acciones: ok con datos, o error en espanol. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const BUCKET = "property-images";
const idSchema = z.string().uuid("Identificador no válido.");
const orderSchema = z.array(z.string().uuid("Identificador de imagen no válido."), {
  required_error: "Falta el orden de las imágenes.",
});

/** Error de dominio: su mensaje es seguro para mostrar al usuario. */
class ActionError extends Error {}

/**
 * Envuelve una accion: convierte ActionError/ZodError en resultado tipado
 * y cualquier fallo inesperado en un mensaje generico (log en servidor).
 */
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
    console.error("[actions/properties] error inesperado:", error);
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

/**
 * Resuelve el perfil del llamador: sesion valida + agencia activa
 * (la impersonacion `active_agency_id` manda sobre la agencia propia).
 */
async function resolveActor(): Promise<Actor> {
  const user = await getUser();
  if (!user) {
    throw new ActionError("Debes iniciar sesión.");
  }

  const supabase = await createServerSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("agency_id, active_agency_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new ActionError("No se ha podido verificar tu perfil.");
  }

  const agencyId =
    profile.active_agency_id !== null ? profile.active_agency_id : profile.agency_id;
  if (!agencyId) {
    throw new ActionError("No tienes ninguna agencia activa.");
  }

  return { userId: user.id, agencyId };
}

/** Mapea la salida validada del schema a columnas de la tabla properties. */
function toPropertyRow(data: PropertyInput) {
  return {
    title: data.title,
    description: data.description ?? null,
    operation: data.operation,
    property_type: data.property_type,
    price: data.price,
    bedrooms: data.bedrooms ?? null,
    bathrooms: data.bathrooms ?? null,
    surface_m2: data.surface_m2 ?? null,
    address: data.address ?? null,
    city: data.city,
    zone: data.zone ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    features: data.features,
  };
}

/**
 * Comprueba que la propiedad existe dentro de la agencia del actor.
 * Necesario ademas de RLS para la impersonacion de super_admin.
 */
async function requireProperty(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  propertyId: string,
  agencyId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!existing) {
    throw new ActionError("Propiedad no encontrada.");
  }
}

/** Crea una propiedad como borrador, generando su referencia REF-XXXX. */
export async function createProperty(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = propertySchema.parse(input);
    const actor = await resolveActor();
    const supabase = await createServerSupabase();

    // Siguiente secuencia: max(reference) de la agencia. Con padding a 4
    // digitos el orden lexicografico coincide con el numerico hasta
    // REF-9999 (suficiente para el MVP; parseReferenceSeq tolera mas).
    const { data: last } = await supabase
      .from("properties")
      .select("reference")
      .eq("agency_id", actor.agencyId)
      .order("reference", { ascending: false })
      .limit(1)
      .maybeSingle();

    const seq =
      (last?.reference ? parseReferenceSeq(last.reference) : null) ?? 0;

    const { data: created, error } = await supabase
      .from("properties")
      .insert({
        ...toPropertyRow(data),
        agency_id: actor.agencyId,
        reference: buildReference(seq + 1),
        status: "borrador",
        created_by: actor.userId,
      })
      .select("id")
      .single();

    if (error || !created) {
      throw new ActionError(
        "No se ha podido crear la propiedad. Inténtalo de nuevo.",
      );
    }

    revalidatePath("/propiedades");
    return { id: created.id as string };
  });
}

/** Actualiza los datos editables de una propiedad (no toca estado ni referencia). */
export async function updateProperty(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const propertyId = idSchema.parse(id);
    const data = propertySchema.parse(input);
    const actor = await resolveActor();
    const supabase = await createServerSupabase();

    await requireProperty(supabase, propertyId, actor.agencyId);

    const { error } = await supabase
      .from("properties")
      .update(toPropertyRow(data))
      .eq("id", propertyId)
      .eq("agency_id", actor.agencyId);

    if (error) {
      throw new ActionError(
        "No se han podido guardar los cambios. Inténtalo de nuevo.",
      );
    }

    revalidatePath(`/propiedades/${propertyId}`);
    revalidatePath("/propiedades");
    return { id: propertyId };
  });
}

/**
 * Cambia el estado de la propiedad (transicion libre entre estados,
 * enmienda controller). Cada cambio queda auditado como actividad
 * tipo 'sistema' para la timeline de visitas futura; ese registro es
 * best-effort: si falla no se revierte el cambio ya confirmado.
 */
export async function setPropertyStatus(
  id: string,
  status: string,
): Promise<ActionResult<{ id: string; status: PropertyStatus }>> {
  return runAction(async () => {
    const propertyId = idSchema.parse(id);
    const nextStatus = propertyStatusSchema.parse(status);
    const actor = await resolveActor();
    const supabase = await createServerSupabase();

    const { data: existing } = await supabase
      .from("properties")
      .select("status")
      .eq("id", propertyId)
      .eq("agency_id", actor.agencyId)
      .maybeSingle();

    if (!existing) {
      throw new ActionError("Propiedad no encontrada.");
    }

    const currentStatus = existing.status as PropertyStatus;
    if (currentStatus === nextStatus) {
      // Idempotente: nada que cambiar ni que auditar.
      return { id: propertyId, status: nextStatus };
    }

    const prevMeta = PROPERTY_STATUS_META[currentStatus];
    const nextMeta = PROPERTY_STATUS_META[nextStatus];

    const { error } = await supabase
      .from("properties")
      .update({ status: nextStatus })
      .eq("id", propertyId)
      .eq("agency_id", actor.agencyId);

    if (error) {
      throw new ActionError(
        "No se ha podido cambiar el estado. Inténtalo de nuevo.",
      );
    }

    // Auditoria para la timeline (Task 12 la renderizara junto a visitas).
    const { error: activityError } = await supabase.from("activities").insert({
      agency_id: actor.agencyId,
      contact_id: null,
      deal_id: null,
      property_id: propertyId,
      type: "sistema",
      title: `Estado cambiado a «${nextMeta.label}»`,
      body: prevMeta ? `Estado anterior: ${prevMeta.label}.` : null,
      due_date: null,
      completed_at: new Date().toISOString(),
      created_by: actor.userId,
    });
    if (activityError) {
      console.error(
        "[actions/properties] no se pudo auditar el cambio de estado:",
        activityError.message,
      );
    }

    revalidatePath(`/propiedades/${propertyId}`);
    revalidatePath("/propiedades");
    return { id: propertyId, status: nextStatus };
  });
}

/**
 * Marca como ganados (won=true, stage='cierre') todos los deals asociados
 * a una propiedad. La llama StatusActions cuando el agente acepta la
 * pregunta «¿marcar sus deals como ganados?» al vender.
 */
export async function markPropertyDealsWon(
  propertyId: string,
): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const id = idSchema.parse(propertyId);
    const actor = await resolveActor();
    const supabase = await createServerSupabase();

    await requireProperty(supabase, id, actor.agencyId);

    const { data: deals, error } = await supabase
      .from("deals")
      .update({ won: true, stage: "cierre" })
      .eq("property_id", id)
      .select("id");

    if (error) {
      throw new ActionError(
        "No se han podido marcar los deals como ganados. Inténtalo de nuevo.",
      );
    }

    // El pipeline (Task 12) revalidara sus propias rutas al montarse;
    // aqui no hay ruta estable todavia que invalidar.
    return { updated: deals?.length ?? 0 };
  });
}

/**
 * Sube una imagen a Storage (`{agency_id}/{propertyId}/{archivo}`) y crea
 * su fila en property_images. Valida mimetype y tamano ANTES de subir
 * (enmienda controller); el agency_id sale del perfil del actor.
 */
export async function uploadImage(
  propertyId: string,
  file: File,
): Promise<ActionResult<{ id: string; url: string; position: number }>> {
  return runAction(async () => {
    if (!(file instanceof File)) {
      throw new ActionError("No se ha recibido ningún archivo.");
    }
    // Enmienda: validacion autoritativa ANTES de tocar Storage.
    const validationError = validateImageFile(file);
    if (validationError) {
      throw new ActionError(validationError);
    }

    const id = idSchema.parse(propertyId);
    const actor = await resolveActor();
    const supabase = await createServerSupabase();

    await requireProperty(supabase, id, actor.agencyId);

    const { data: lastImage } = await supabase
      .from("property_images")
      .select("position")
      .eq("property_id", id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition = (lastImage?.position ?? 0) + 1;

    // Prefijo temporal para evitar colisiones con nombres repetidos.
    const path = `${actor.agencyId}/${id}/${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      throw new ActionError(
        "No se ha podido subir la imagen. Comprueba tu conexión e inténtalo de nuevo.",
      );
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { data: inserted, error: insertError } = await supabase
      .from("property_images")
      .insert({ property_id: id, url: publicUrl.publicUrl, position: nextPosition })
      .select("id, url, position")
      .single();

    if (insertError || !inserted) {
      // La fila es la fuente de verdad: si no se registro, limpiamos el objeto.
      await supabase.storage.from(BUCKET).remove([path]);
      throw new ActionError(
        "La imagen se subió, pero no se pudo registrar. Inténtalo de nuevo.",
      );
    }

    revalidatePath(`/propiedades/${id}`);
    return inserted as { id: string; url: string; position: number };
  });
}

/** Elimina una imagen: fila en BD + objeto best-effort en Storage. */
export async function deleteImage(
  imageId: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const id = idSchema.parse(imageId);
    const actor = await resolveActor();
    const supabase = await createServerSupabase();

    const { data: image } = await supabase
      .from("property_images")
      .select("url, property_id")
      .eq("id", id)
      .maybeSingle();

    if (!image) {
      throw new ActionError("Imagen no encontrada.");
    }

    // Verificacion explicita de pertenencia (impersonacion super_admin).
    await requireProperty(supabase, image.property_id, actor.agencyId);

    const { error } = await supabase.from("property_images").delete().eq("id", id);
    if (error) {
      throw new ActionError(
        "No se ha podido eliminar la imagen. Inténtalo de nuevo.",
      );
    }

    // Limpieza best-effort del objeto: la fila ya no existe.
    const storagePath = storagePathFromPublicUrl(image.url);
    if (storagePath) {
      const { error: removeError } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);
      if (removeError) {
        console.error(
          "[actions/properties] objeto huérfano en Storage:",
          storagePath,
          removeError.message,
        );
      }
    }

    revalidatePath(`/propiedades/${image.property_id}`);
    return { id };
  });
}

/** Persiste el nuevo orden de la galeria calculado con computePositions. */
export async function reorderImages(
  propertyId: string,
  ids: string[],
): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const id = idSchema.parse(propertyId);
    const orderedIds = orderSchema.parse(ids);
    const actor = await resolveActor();
    const supabase = await createServerSupabase();

    await requireProperty(supabase, id, actor.agencyId);

    // Secuencial (listas pequenas): evita carreras de escritura simultaneas.
    for (const update of computePositions(orderedIds)) {
      const { error } = await supabase
        .from("property_images")
        .update({ position: update.position })
        .eq("id", update.id)
        .eq("property_id", id);
      if (error) {
        throw new ActionError(
          "No se ha podido guardar el orden de las imágenes. Inténtalo de nuevo.",
        );
      }
    }

    revalidatePath(`/propiedades/${id}`);
    return { count: orderedIds.length };
  });
}
