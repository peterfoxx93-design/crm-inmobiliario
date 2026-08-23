import type { ReactNode } from "react";

import { DEFAULT_BRAND_COLOR, pickBrandForeground } from "@/lib/color";

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
 */
export function BrandProvider({ color, children }: BrandProviderProps) {
  const brand = color || DEFAULT_BRAND_COLOR;
  const brandFg = pickBrandForeground(brand);

  return (
    <div
      className="contents"
      style={
        { "--brand": brand, "--brand-fg": brandFg } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
