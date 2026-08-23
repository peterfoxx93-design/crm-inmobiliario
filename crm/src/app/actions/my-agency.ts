"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  inviteUser,
  resolveSettingsActor,
  setUserActive,
  updateAgencyBrandingRow,
} from "@/lib/admin-users";
import { validateImageFile } from "@/lib/image-upload";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Agency } from "@/lib/types";
import { brandSchema } from "@/lib/validators/my-agency";
import { inviteSchema, type InviteUserInput } from "@/lib/validators/user";

/**
 * Server actions de Ajustes (Task 16): gestion de miembros y branding de la
 * propia agencia. Mismo contrato que actions/deals: resultados tipados
 * ActionResult<T>, sin throws crudos al cliente. La agencia sale SIEMPRE del
 * perfil del actor y el guard de rol se aplica en servidor (patron Task 6);
 * service_role solo dentro de lib/admin-users.ts tras ese guard.
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
    // Los errores de dominio de lib/admin-users.ts traen mensaje en espanol
    // pensado para el usuario; se muestran tal cual.
    if (error instanceof Error && error.message) {
      return { ok: false, error: error.message };
    }
    console.error("[actions/my-agency] error inesperado:", error);
    return {
      ok: false,
      error: "Se ha producido un error inesperado. Inténtalo de nuevo.",
    };
  }
}

/** Invita un usuario (email + nombre + rol admin|agent). Reusa inviteUser. */
export async function inviteUserAction(
  input: InviteUserInput,
): Promise<ActionResult<{ invited: true }>> {
  return runAction(async () => {
    await inviteUser(inviteSchema.parse(input));
    revalidatePath("/ajustes");
    return { invited: true };
  });
}

/** Desactiva el acceso de un miembro (ban via Auth Admin). */
export async function deactivateUserAction(
  userId: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const id = z.string().uuid("Identificador de usuario no válido.").parse(userId);
    await setUserActive(id, false);
    revalidatePath("/ajustes");
    return { id };
  });
}

/** Reactiva el acceso de un miembro previamente desactivado. */
export async function reactivateUserAction(
  userId: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const id = z.string().uuid("Identificador de usuario no válido.").parse(userId);
    await setUserActive(id, true);
    revalidatePath("/ajustes");
    return { id };
  });
}

/**
 * Actualiza nombre/logo/color de la agencia del actor (parcial).
 * Solo admin/super_admin; valida el hex con brandSchema (lib/color).
 * revalidatePath("/", "layout") refresca el shell completo (nombre y color
 * en sidebar/bottombar llegan del layout del grupo (app)).
 */
export async function updateMyAgencyBrand(
  input: unknown,
): Promise<
  ActionResult<{
    name: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  }>
> {
  return runAction(async () => {
    const data = brandSchema.parse(input);
    const actor = await resolveSettingsActor("editar los datos de la agencia");

    const row: Partial<Pick<Agency, "name" | "logo_url" | "primary_color">> = {};
    if (data.name !== undefined) row.name = data.name;
    if (data.logoUrl !== undefined) row.logo_url = data.logoUrl;
    if (data.primaryColor !== undefined) row.primary_color = data.primaryColor;

    await updateAgencyBrandingRow(actor.agencyId, row);

    revalidatePath("/", "layout");
    return {
      name: data.name ?? null,
      logoUrl: data.logoUrl ?? null,
      primaryColor: data.primaryColor ?? null,
    };
  });
}

const BRANDING_BUCKET = "branding";

/** Extension por mimetype; validateImageFile ya acoto el set permitido. */
const LOGO_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * Sube el logo a Storage (`branding/{agency_id}/logo.<ext>`, upsert para
 * sobreescribir) y persiste agencies.logo_url. Validacion de imagen como
 * Task 10 ANTES de tocar Storage; la subida usa el cliente SSR con RLS
 * (policies storage_branding_* ya limitan a la carpeta de la agencia).
 */
export async function uploadAgencyLogo(
  file: File,
): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    if (!(file instanceof File)) {
      throw new ActionError("No se ha recibido ningún archivo.");
    }
    const validationError = validateImageFile(file);
    if (validationError) {
      throw new ActionError(validationError);
    }

    const actor = await resolveSettingsActor("subir el logo de la agencia");
    const supabase = await createServerSupabase();

    const ext = LOGO_EXT_BY_MIME[file.type];
    if (!ext) {
      throw new ActionError(
        "El archivo no es una imagen válida (JPG, PNG, WEBP, GIF o AVIF).",
      );
    }

    const path = `${actor.agencyId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      throw new ActionError(
        "No se ha podido subir el logo. Inténtalo de nuevo.",
      );
    }

    const { data: publicUrl } = supabase.storage
      .from(BRANDING_BUCKET)
      .getPublicUrl(path);

    try {
      await updateAgencyBrandingRow(actor.agencyId, {
        logo_url: publicUrl.publicUrl,
      });
    } catch (error) {
      // El objeto queda subido pero sin registrar: limpiamos como uploadImage.
      await supabase.storage.from(BRANDING_BUCKET).remove([path]);
      throw error;
    }

    // Limpieza best-effort de logos anteriores con otra extension.
    const stalePaths = Object.values(LOGO_EXT_BY_MIME)
      .filter((otherExt) => otherExt !== ext)
      .map((otherExt) => `${actor.agencyId}/logo.${otherExt}`);
    await supabase.storage.from(BRANDING_BUCKET).remove(stalePaths);

    revalidatePath("/", "layout");
    return { url: publicUrl.publicUrl };
  });
}
