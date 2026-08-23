import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Agency, ProfileRole } from "@/lib/types";
import { isAdminRole, memberManagementError } from "@/lib/settings-access";
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
 * Resuelve el actor de Ajustes (Task 16): sesion valida + rol admin +
 * agencia efectiva (`active_agency_id ?? agency_id`, impersonacion incluida).
 * `accion` se interpola en los mensajes para dar contexto en espanol.
 */
export interface SettingsActor {
  userId: string;
  role: ProfileRole;
  agencyId: string;
}

export async function resolveSettingsActor(
  accion = "realizar esta acción",
): Promise<SettingsActor> {
  const user = await getUser();
  if (!user) {
    throw new Error(`Debes iniciar sesión para ${accion}.`);
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
  if (!isAdminRole(role)) {
    throw new Error(`Solo un administrador puede ${accion}.`);
  }

  // Igual que get_my_agency_id(): la impersonación manda sobre la agencia propia.
  const agencyId = profile.active_agency_id ?? profile.agency_id;
  if (!agencyId) {
    throw new Error(`No tienes ninguna agencia activa para ${accion}.`);
  }

  return { userId: user.id, role, agencyId };
}

/**
 * Resuelve la agencia destino del invitado a partir del perfil del llamador.
 * Lanza error en español si no está autenticado, sin agencia o sin permiso.
 */
async function resolveInvokerAgency(): Promise<string> {
  const actor = await resolveSettingsActor("invitar usuarios");
  return actor.agencyId;
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

// ---------------------------------------------------------------------------
// Gestion de miembros y branding de la propia agencia (Task 16).
// Mismo patron: guard de rol en servidor con el cliente SSR (RLS) y SOLO
// despues se usa service_role para lo que RLS no cubre (Auth Admin y el
// update de `agencies`, cuya policy solo deja escribir al super_admin).
// ---------------------------------------------------------------------------

/** Fila de usuario lista para la tabla de Ajustes (serializable). */
export interface AgencyUserRow {
  id: string;
  fullName: string;
  /** Email desde Auth Admin (`profiles` no guarda email). "" si falta. */
  email: string;
  role: ProfileRole;
  avatarUrl: string | null;
  /** false = acceso desactivado (usuario baneado en Auth). */
  active: boolean;
}

/**
 * Duracion del ban para "desactivar acceso": ~100 anos (GoTrue acepta una
 * duracion tipo `168h`; no hay ban permanente como tal).
 */
const DEACTIVATE_BAN_DURATION = "876000h";

/** Lista los perfiles de la agencia efectiva del actor + email/estado de Auth. */
export async function listAgencyUsers(): Promise<AgencyUserRow[]> {
  const actor = await resolveSettingsActor("gestionar usuarios");
  const supabase = await createServerSupabase();

  // Lectura por RLS: profiles_select_own_or_agency ya filtra a la agencia.
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .eq("agency_id", actor.agencyId)
    .order("full_name", { ascending: true });

  if (error || !profiles) {
    throw new Error("No se ha podido cargar la lista de usuarios.");
  }

  // Emails y estado de ban: unicamente via Auth Admin (service_role),
  // tras haber validado rol/agencia del llamador.
  const admin = createAdminSupabase();
  const authUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError || !data) {
      throw new Error("No se ha podido cargar la lista de usuarios.");
    }
    authUsers.push(...data.users);
    if (data.users.length < 200) break;
  }

  const byId = new Map(authUsers.map((u) => [u.id, u]));
  const now = Date.now();

  return profiles.flatMap((p) => {
    const role = p.role as ProfileRole;
    // Un super_admin nunca se gestiona desde Ajustes (ni siquiera se lista).
    if (role === "super_admin") return [];

    const authUser = byId.get(p.id);
    const bannedUntil = authUser?.banned_until
      ? Date.parse(authUser.banned_until)
      : null;
    const active =
      bannedUntil === null || Number.isNaN(bannedUntil) || bannedUntil <= now;

    return [
      {
        id: p.id,
        fullName: p.full_name,
        email: authUser?.email ?? "",
        role,
        avatarUrl: p.avatar_url ?? null,
        active,
      },
    ];
  });
}

/**
 * Activa o desactiva el ACCESO de un miembro (ban en Auth Admin). El perfil
 * no se toca: al reactivar, el usuario vuelve tal cual. Guard puro de
 * lib/settings-access.ts aplicado antes de tocar service_role:
 * jamas self-ban, jamas sobre super_admin, jamas fuera de la agencia.
 */
export async function setUserActive(
  targetId: string,
  active: boolean,
): Promise<void> {
  const accion = active ? "reactivar usuarios" : "desactivar usuarios";
  const actor = await resolveSettingsActor(accion);
  const supabase = await createServerSupabase();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, agency_id")
    .eq("id", targetId)
    .maybeSingle();

  if (!target) {
    throw new Error("Usuario no encontrado.");
  }

  const guardError = memberManagementError(
    { userId: actor.userId, role: actor.role, agencyId: actor.agencyId },
    {
      id: target.id,
      role: target.role as ProfileRole,
      agencyId: target.agency_id,
    },
  );
  if (guardError) throw new Error(guardError);

  const admin = createAdminSupabase();
  const { error } = await admin.auth.admin.updateUserById(targetId, {
    ban_duration: active ? "none" : DEACTIVATE_BAN_DURATION,
  });

  if (error) {
    throw mapAuthError(
      active
        ? "No se ha podido reactivar el acceso."
        : "No se ha podido desactivar el acceso.",
      error,
    );
  }
}

/**
 * Update del branding en `agencies` con service_role. La RLS solo permite
 * escribir agencies al super_admin; aqui el guard de rol (resolveSettingsActor)
 * ya autorizo al admin de ESA agencia en servidor, igual que inviteUser.
 */
export async function updateAgencyBrandingRow(
  agencyId: string,
  patch: Partial<Pick<Agency, "name" | "logo_url" | "primary_color">>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("agencies")
    .update(patch)
    .eq("id", agencyId);

  if (error) {
    throw new Error("No se han podido guardar los cambios de la agencia.");
  }
}
