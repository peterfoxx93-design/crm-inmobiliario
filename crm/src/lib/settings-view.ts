/**
 * Parseo del tab de /ajustes por querystring (Task 16), mismo patron que
 * la vista de Agenda: `?tab=usuarios|branding|captacion`. La tab vive en la
 * URL para que compartir/recargar mantenga la seccion visible.
 */

export type SettingsTab = "usuarios" | "branding" | "captacion";

/** Tab por defecto: branding (datos de la agencia). */
export function parseSettingsTab(
  params: Record<string, string | string[] | undefined>,
): SettingsTab {
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  if (raw === "usuarios") return "usuarios";
  if (raw === "captacion") return "captacion";
  return "branding";
}
