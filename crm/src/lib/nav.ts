/**
 * Definicion de la navegacion principal del shell (Task 7).
 * Libre de React/iconos para poder testearla en node; los iconos se mapean
 * en el componente Sidebar.
 */

import type { ProfileRole } from "@/lib/types";

export interface NavItem {
  /** Ruta interna de la seccion. */
  href: string;
  /** Etiqueta visible en espanol. */
  label: string;
}

/** Secciones base para todos los roles (brief Step 1). */
const BASE_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/propiedades", label: "Propiedades" },
  { href: "/contactos", label: "Contactos" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/agenda", label: "Agenda" },
  { href: "/ajustes", label: "Ajustes" },
];

/**
 * Items de navegacion segun el rol del perfil.
 * Solo `super_admin` ve la gestion multi-agencia ("Maestro").
 */
export function getNavItems(role: ProfileRole): NavItem[] {
  if (role === "super_admin") {
    return [...BASE_NAV, { href: "/maestro", label: "Maestro" }];
  }
  return [...BASE_NAV];
}

/** Secciones fijas del BottomBar movil (brief Step 3). */
export const MOBILE_TABS: readonly NavItem[] = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/propiedades", label: "Propiedades" },
  { href: "/contactos", label: "Contactos" },
  { href: "/pipeline", label: "Pipeline" },
];
