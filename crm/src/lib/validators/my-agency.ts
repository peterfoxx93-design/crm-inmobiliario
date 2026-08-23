import { z } from "zod";

import { parseHex } from "@/lib/color";

/**
 * Esquemas del formulario de branding de agencia (Task 16).
 * Extraidos a lib/ para poder testearlos en node y para que la server action
 * `updateMyAgencyBrand` (use server) solo exporte tipos/funciones de accion.
 */

/** Convierte cualquier hex aceptado por parseHex en `#rrggbb` minusculas. */
function toFullHex(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Color primario de marca: hex valido (#RGB o #RRGGBB, con o sin #) que se
 * NORMALIZA a `#rrggbb` minusculas. Asi BrandProvider y color.ts reciben
 * siempre el mismo formato, venga del input de texto o del color picker.
 */
export const hexColorSchema = z
  .string({
    required_error: "El color primario es obligatorio.",
    invalid_type_error: "El color debe ser un texto.",
  })
  .trim()
  .refine(
    (value) => parseHex(value) !== null,
    "Introduce un color hexadecimal válido (por ejemplo #2563eb).",
  )
  .transform((value) => toFullHex(value) ?? value);

/**
 * Actualizacion parcial del branding: al menos un campo presente.
 * - name: se recorta; obligatorio si viene.
 * - logoUrl: URL publica o null para quitar el logo actual.
 * - primaryColor: hex normalizado.
 */
export const brandSchema = z
  .object({
    name: z
      .string({
        invalid_type_error: "El nombre debe ser un texto.",
      })
      .trim()
      .min(1, "El nombre de la agencia es obligatorio.")
      .max(80, "El nombre no puede superar los 80 caracteres.")
      .optional(),
    logoUrl: z
      .string({
        invalid_type_error: "La URL del logo debe ser un texto.",
      })
      .url("La URL del logo no es válida.")
      // Endurecimiento review Task 16: .url() de zod acepta javascript:/data:.
      // El logo solo puede vivir en https (Storage publico incluido).
      .refine(
        (value) => value.toLowerCase().startsWith("https://"),
        "La URL del logo debe usar https://.",
      )
      .nullable()
      .optional(),
    primaryColor: hexColorSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.logoUrl !== undefined ||
      data.primaryColor !== undefined,
    { message: "No hay ningún cambio que guardar." },
  );

export type BrandInput = z.infer<typeof brandSchema>;
