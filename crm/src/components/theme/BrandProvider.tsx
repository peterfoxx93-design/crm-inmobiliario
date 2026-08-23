import type { ReactNode } from "react";

import { buildBrandStyle } from "@/lib/brand-preview";

interface BrandProviderProps {
  /** Color primario de la agencia (authoritative, desde el servidor). */
  color: string | null;
  children: ReactNode;
}

/**
 * Setea las variables CSS `--brand` y `--brand-fg` del shell.
 *
 * Enmienda controller: `--brand-fg` se calcula con contraste WCAG
 * (negro o blanco, el de mayor contraste sobre el color de agencia).
 * El valor autoritativo llega del servidor (`agency.primary_color`);
 * se aplica como estilo inline en SSR para evitar parpadeo. La clave
 * localStorage `agency_slug` NO hace falta aqui: si no hay agencia
 * (super_admin sin impersonar) se usa el color por defecto.
 *
 * Fix review Task 16: publica el valor guardado en `--brand-saved(-fg)` y
 * compone las vars de consumo con `var(--brand-preview, ...)` para que el
 * preview en vivo de Ajustes > Branding (escrito en documentElement por
 * lib/brand-preview.ts) gane al guardado mientras se edita, pese a que este
 * div esta mas cerca del shell que `<html>`.
 */
export function BrandProvider({ color, children }: BrandProviderProps) {
  return (
    <div
      className="contents"
      style={buildBrandStyle(color) as React.CSSProperties}
    >
      {children}
    </div>
  );
}
