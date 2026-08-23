import {
  DEFAULT_BRAND_COLOR,
  parseHex,
  pickBrandForeground,
} from "@/lib/color";

/**
 * Contrato de preview en vivo del branding (fix review Task 16).
 *
 * Problema: BrandProvider declara `--brand` inline en su wrapper, que esta
 * MAS CERCA del shell que `<html>`; escribir el preview en documentElement
 * quedaba sombreado y el shell no cambiaba de color al editar.
 *
 * Solucion (Opcion A): BrandProvider publica inline `--brand-saved(-fg)`
 * (anti-parpadeo SSR intacto) y compone las vars de consumo:
 *   --brand    = var(--brand-preview,    var(--brand-saved))
 *   --brand-fg = var(--brand-preview-fg, var(--brand-fg-saved))
 * Mientras se edita, BrandingForm escribe `--brand-preview(-fg)` en
 * documentElement (hereda hacia todo el arbol); al desmontar se borran y el
 * valor guardado vuelve a mandar.
 */

/** Var que publica el preview mientras se edita (en documentElement). */
export const BRAND_PREVIEW_VAR = "--brand-preview";
export const BRAND_PREVIEW_FG_VAR = "--brand-preview-fg";

/**
 * Estilo inline del wrapper de BrandProvider: valor guardado + composicion
 * con la var de preview. El color se NORMALIZA a #rrggbb minusculas (o
 * defecto si es invalido/null) para un estilo determinista en SSR.
 * Objeto plano para poder testearlo en node.
 */
export function buildBrandStyle(color: string | null): Record<string, string> {
  const rgb = color ? parseHex(color) : null;
  const brand = rgb
    ? `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`
    : DEFAULT_BRAND_COLOR;
  const brandFg = pickBrandForeground(brand);

  return {
    "--brand-saved": brand,
    "--brand-fg-saved": brandFg,
    "--brand": `var(${BRAND_PREVIEW_VAR}, var(--brand-saved))`,
    "--brand-fg": `var(${BRAND_PREVIEW_FG_VAR}, var(--brand-fg-saved))`,
  };
}

/** document.documentElement.style, o null en SSR (guard sin crash). */
function docStyle(): CSSStyleDeclaration | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.style;
}

/**
 * Publica el preview del color (normalizado) en documentElement. Colores
 * invalidos se ignoran: el formulario ya muestra su propio error.
 */
export function applyBrandPreview(hex: string): void {
  const rgb = parseHex(hex);
  if (!rgb) return;

  const normalized = `#${rgb
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
  const style = docStyle();
  if (!style) return;

  style.setProperty(BRAND_PREVIEW_VAR, normalized);
  style.setProperty(BRAND_PREVIEW_FG_VAR, pickBrandForeground(normalized));
}

/** Retira las vars de preview: el valor guardado vuelve a mandar. */
export function clearBrandPreview(): void {
  const style = docStyle();
  if (!style) return;

  style.removeProperty(BRAND_PREVIEW_VAR);
  style.removeProperty(BRAND_PREVIEW_FG_VAR);
}
