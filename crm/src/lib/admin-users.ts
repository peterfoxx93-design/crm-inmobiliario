import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { ProfileRole } from "@/lib/types";
import { getUser, createServerSupabase } from "@/lib/supabase/server";
import { inviteSchema, type InviteUserInput } from "@/lib/validators/user";

/**
 * Alta de usuarios por invitación (brief Task 6) — SOLO SERVIDOR.
 *
 * Este módulo usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS): el import
 * "server-only" garantiza en build que jamás termine en un Client Component.
 * La única puerta de entrada prevista es la server action de Ajustes
 * (Task 16), que además re-validará permisos con la O2.
 *
 * Flujo:
 *  1. Se valida la entrada con `inviteSchema`.
 *  2. Se resuelve el perfil del llamador (cliente SSR con anon key y RLS)
 *     para autorizar (admin/super_admin) y fijar `agency_id` del invitado,
 *     respetando la impersonación (`active_agency_id`), igual que
 *     `get_my_agency_id()` en SQL.
 *  3. Con el client admin se crea el usuario YA CONFIRMADO
 *     (`email_confirm: true`) con `user_metadata {agency_id, role, full_name}`;
 *     el trigger `handle_new_user` (Task 3) crea su profile en el INSERT.
 *  4. `generateLink({type:"invite"})` genera el enlace de invitación
 *     (no envía email; queda disponible para la UI/resend de Ajustes).
 */

/** Crea el client admin con service_role (nunca exponer al cliente). */
function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Resuelve la agencia destino del invitado a partir del perfil del llamador.
 * Lanza error en español si no está autenticado, sin agencia o sin permiso.
 */
async function resolveInvokerAgency(): Promise<string> {
  const user = await getUser();
  if (!user) {
    throw new Error("Debes iniciar sesión para invitar usuarios.");
  }

  const supabase = await createServerSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, agency_id, active_agency_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error("No se ha podido verificar tu perfil.");
  }

  const role = profile.role as ProfileRole;
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Solo un administrador puede invitar usuarios.");
  }

  // Igual que get_my_agency_id(): la impersonación manda sobre la agencia propia.
  const agencyId = profile.active_agency_id ?? profile.agency_id;
  if (!agencyId) {
    throw new Error("No tienes ninguna agencia activa para invitar usuarios.");
  }

  return agencyId;
}

/** Envuelve un error de Auth Admin en un mensaje útil en español. */
function mapAuthError(message: string, error: { message?: string }): Error {
  const detail = error.message ? ` (${error.message})` : "";
  return new Error(`${message}${detail}`);
}

export async function inviteUser(input: InviteUserInput): Promise<void> {
  // 1) Validación (normaliza email y recorta fullName).
  const data = inviteSchema.parse(input);

  // 2) Autorización + agencia destino del invitado.
  const agencyId = await resolveInvokerAgency();

  // 3) Creación del usuario confirmado con metadata para el trigger.
  const admin = createAdminSupabase();
  const { error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    email_confirm: true,
    user_metadata: {
      agency_id: agencyId,
      role: data.role,
      full_name: data.fullName,
    },
  });

  if (createError) {
    if (createError.code === "email_exists") {
      throw new Error("Ese email ya está registrado.");
    }
    throw mapAuthError(
      "No se pudo crear el usuario. Comprueba que el email no esté registrado e inténtalo de nuevo.",
      createError,
    );
  }

  // 4) Enlace de invitación (signup/invite generan el usuario si no existe;
  // aquí ya existe, así que solo devuelve action_link para la UI).
  const { error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: data.email,
  });

  if (linkError) {
    throw mapAuthError(
      "El usuario se creó, pero no se pudo generar el enlace de invitación.",
      linkError,
    );
  }
}
