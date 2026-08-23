import "server-only";

import { getUser, createServerSupabase } from "@/lib/supabase/server";
import {
  maestroAccessError,
  type MasterActor,
} from "@/lib/master-access";
import type { ProfileRole } from "@/lib/types";

/**
 * Resolucion de actores del panel maestro (Task 17) — SOLO SERVIDOR.
 * Lo consumen las server actions de app/actions/agencies.ts y las lecturas
 * de lib/queries/agencies.ts:
 * - resolveMaestroActor: sesion + super_admin SIN suplantacion activa
 *   (abrir /maestro y gestionar agencias);
 * - resolveSuperAdminActor: sesion + super_admin, con o sin suplantacion
 *   (impersonateStart/Stop aplican sus guards propios despues).
 */

export interface MaestroActor {
  userId: string;
  role: Extract<ProfileRole, "super_admin">;
}

/** Perfil crudo del llamador; null si no hay sesion o fila ilegible. */
async function loadProfileRow(): Promise<{
  userId: string;
  role: ProfileRole;
  activeAgencyId: string | null;
} | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, active_agency_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;

  return {
    userId: user.id,
    role: profile.role as ProfileRole,
    activeAgencyId: profile.active_agency_id ?? null,
  };
}

/**
 * Resuelve y autoriza al actor del panel maestro; lanza error en espanol si
 * no hay sesion, el perfil no se puede leer o falla el guard puro de
 * lib/master-access.ts (rol distinto de super_admin, o suplantando ahora).
 */
export async function resolveMaestroActor(): Promise<MaestroActor> {
  const row = await loadProfileRow();
  if (!row) {
    throw new Error("No se ha podido verificar tu perfil.");
  }

  const guardError = maestroAccessError(row);
  if (guardError) {
    throw new Error(guardError);
  }

  return { userId: row.userId, role: "super_admin" };
}

/**
 * Resuelve un super_admin autenticado (con o sin suplantacion activa).
 * Los guards especificos de iniciar/parar la suplantacion viven en
 * lib/master-access.ts y se aplican en la accion con el actor devuelto.
 */
export async function resolveSuperAdminActor(): Promise<MasterActor> {
  const row = await loadProfileRow();
  if (!row || row.role !== "super_admin") {
    throw new Error("Solo un superadministrador puede suplantar a una agencia.");
  }

  return {
    userId: row.userId,
    role: row.role,
    activeAgencyId: row.activeAgencyId,
  };
}
