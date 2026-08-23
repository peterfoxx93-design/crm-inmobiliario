import type { ProfileRole } from "@/lib/types";

/**
 * Guards puros del panel maestro e impersonacion (Task 17).
 * Libre de React/Next/Supabase para poder testearlo en node; las server
 * actions de app/actions/agencies.ts los aplican ANTES de escribir nada,
 * igual que settings-access.ts hace para Ajustes (Task 16).
 *
 * Decisiones documentadas:
 * - /maestro exige super_admin SIN impersonacion activa: navegar al panel
 *   maestro mientras se ve otra agencia invita a confusion anidada; el
 *   banner amarillo permite "Salir" y volver a entrar.
 * - impersonateStart rechaza el inicio doble con error explicito (no hay
 *   auto-stop encadenado: salir es una accion propia y queda auditada).
 * - la agencia destino puede estar activa O desactivada: el caso de uso
 *   principal es soporte/diagnostico, y la visibilidad de lectura no cambia
 *   (is_super_admin ya la concede); la suplantacion solo fija el contexto
 *   efectivo de escritura (coalesce(active_agency_id, agency_id)).
 */

export interface MasterActor {
  userId: string;
  role: ProfileRole;
  /** Impersonacion activa: active_agency_id del perfil (null si ninguna). */
  activeAgencyId: string | null;
}

export interface ImpersonationTarget {
  id: string;
  /** false = agencia desactivada (login bloqueado para sus usuarios). */
  active: boolean;
}

/**
 * Error (en espanol) si el actor NO puede abrir el panel maestro; null si
 * puede. Cierra la deuda de guard servidor de /maestro (Task 7).
 */
export function maestroAccessError(actor: MasterActor): string | null {
  if (actor.role !== "super_admin") {
    return "Solo un superadministrador puede acceder al panel maestro.";
  }
  if (actor.activeAgencyId !== null) {
    return "No puedes abrir el panel maestro mientras estás viendo otra agencia. Sal primero.";
  }
  return null;
}

/**
 * Error si el actor NO puede iniciar la suplantacion de `target` (null si
 * ya no existe la fila de agencia).
 */
export function impersonationStartError(
  actor: MasterActor,
  target: ImpersonationTarget | null,
): string | null {
  if (actor.role !== "super_admin") {
    return "Solo un superadministrador puede suplantar a una agencia.";
  }
  if (actor.activeAgencyId !== null) {
    return "Ya estás viendo otra agencia. Sal primero antes de entrar en otra.";
  }
  if (!target) {
    return "La agencia no existe.";
  }
  // Activa o desactivada: ambas validas (ver cabecera).
  return null;
}

/** Error si el actor NO puede cerrar la suplantacion activa. */
export function impersonationStopError(actor: MasterActor): string | null {
  if (actor.role !== "super_admin") {
    return "Solo un superadministrador puede salir de una suplantación.";
  }
  if (actor.activeAgencyId === null) {
    return "No estás viendo ninguna agencia.";
  }
  return null;
}
