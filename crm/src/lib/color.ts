/**
 * Utilidades de color para el branding por agencia (Task 7, enmienda
 * controller): calculo de luminancia y contraste segun WCAG 2.x para elegir
 * un color de primer plano legible (`--brand-fg`) sobre `--brand`.
 *
 * Funciones puras y libres de React/Next para poder testearlas en node.
 */

export type Rgb = readonly [number, number, number];

/** Parsea un color hexadecimal (#rgb o #rrggbb, con o sin `#`). Null si es invalido. */
export function parseHex(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const raw = match[1];
  const full =
    raw.length === 3
      ? Array.from(raw, (c) => c + c).join("")
      : raw.toLowerCase();
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Linealiza un canal sRGB (0-255) segun la curva de WCAG. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Luminancia relativa WCAG (0 = negro, 1 = blanco).
 * Devuelve null si `hex` no es un color valido.
 */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return (
    0.2126 * linearize(rgb[0]) +
    0.7152 * linearize(rgb[1]) +
    0.0722 * linearize(rgb[2])
  );
}

/** Ratio de contraste WCAG entre dos colores hex (1 a 21). Null si alguno es invalido. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

const BLACK = "#000000";
const WHITE = "#ffffff";

/**
 * Elige el primer plano con MAYOR contraste sobre el color de marca:
 * negro o blanco, lo que resulte mas legible (enmienda controller).
 * Si el color no se puede parsear devuelve blanco.
 */
export function pickBrandForeground(brandColor: string): string {
  const vsWhite = contrastRatio(brandColor, WHITE);
  const vsBlack = contrastRatio(brandColor, BLACK);
  if (vsWhite === null || vsBlack === null) return WHITE;
  return vsWhite >= vsBlack ? WHITE : BLACK;
}

/** Color de marca por defecto mientras no haya agencia (p. ej. super_admin impersonando). */
export const DEFAULT_BRAND_COLOR = "#2563eb";
