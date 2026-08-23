import type { ProfileRole } from "@/lib/types";

/**
 * Guard puro de permisos para la gestion de miembros (Task 16).
 * Libre de React/Next/Supabase para poder testearlo en node; las funciones
 * de servidor en lib/admin-users.ts lo aplican ANTES de tocar Auth Admin.
 *
 * Orden deliberado de las reglas:
 *  1. rol del actor (admin/super_admin);
 *  2. nunca sobre la propia cuenta (auto-baneo imposible);
 *  3. nunca sobre una cuenta super_admin;
 *  4. solo miembros de la MISMA agencia efectiva del actor
 *     (`active_agency_id ?? agency_id`, impersonacion incluida).
 */

export interface ActorContext {
  userId: string;
  role: ProfileRole;
  /** Agencia efectiva del actor; null si super_admin sin impersonar. */
  agencyId: string | null;
}

export interface MemberTarget {
  id: string;
  role: ProfileRole;
  agencyId: string | null;
}

/** true si el rol puede gestionar usuarios/branding de una agencia. */
export function isAdminRole(role: ProfileRole): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Devuelve el mensaje de error en espanol si el actor NO puede gestionar a
 * `target`, o null si la operacion esta permitida.
 */
export function memberManagementError(
  actor: ActorContext,
  target: MemberTarget,
): string | null {
  if (!isAdminRole(actor.role)) {
    return "Solo un administrador puede gestionar usuarios.";
  }
  if (target.id === actor.userId) {
    return "No puedes desactivar tu propia cuenta.";
  }
  if (target.role === "super_admin") {
    return "No puedes gestionar una cuenta de superadministrador.";
  }
  if (target.agencyId !== actor.agencyId) {
    return "El usuario no pertenece a tu agencia.";
  }
  return null;
}
