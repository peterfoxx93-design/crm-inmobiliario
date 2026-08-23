import { z } from "zod";

import { FEATURES_LIST } from "@/lib/constants";

/**
 * Enums alineados con los CHECK constraints del DDL
 * (supabase/migrations/0001_schema.sql, tablas `properties`).
 */
export const PROPERTY_OPERATIONS = ["venta", "alquiler"] as const;
export const PROPERTY_TYPE_IDS = [
  "piso",
  "casa",
  "villa",
  "terreno",
  "local",
  "oficina",
  "otro",
] as const;
export const PROPERTY_STATUSES = [
  "borrador",
  "activo",
  "reservado",
  "vendido",
  "retirado",
] as const;

/** IDs validos de `features`, acotados al catalogo fijo de la UI (enmienda controller). */
const FEATURE_ID_SET = new Set(FEATURES_LIST.map((feature) => feature.id));

/**
 * Convierte "", null y NaN en undefined.
 * Los inputs numericos con `valueAsNumber` producen NaN cuando quedan vacios,
 * y los de texto "" — ambos deben tratarse como "sin valor" para que las
 * reglas `.optional()` / required_error se apliquen con mensajes claros.
 */
function emptyToUndefined(value: unknown): unknown {
  if (
    value === "" ||
    value === null ||
    (typeof value === "number" && Number.isNaN(value))
  ) {
    return undefined;
  }
  return value;
}

/** Numero entero opcional (admite vacio -> undefined). */
function optionalInt(min: number, max: number, label: string) {
  return z.preprocess(
    emptyToUndefined,
    z
      .number({
        invalid_type_error: `${label} debe ser un número.`,
      })
      .int(`${label} debe ser un número entero.`)
      .min(min, `${label} no puede ser negativo.`)
      .max(max, `${label} es demasiado alto.`)
      .nullable()
      .optional(),
  );
}

/** Texto opcional recortado; el vacio pasa a undefined (la UI envia ""). */
function optionalText(max: number) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string({ invalid_type_error: "Debe ser un texto." })
      .trim()
      .max(max, `No puede superar ${max} caracteres.`)
      .nullable()
      .optional(),
  );
}

/**
 * Valida los datos del formulario de propiedad antes de tocar la BD
 * (brief Task 10 + enmienda controller):
 * - title >= 5 caracteres (tras trim);
 * - operation / property_type enums cerrados;
 * - price > 0 (coherente con negocio; el CHECK de BD permite >= 0);
 * - bedrooms/bathrooms enteros >= 0 opcionales; surface_m2 > 0 opcional;
 * - city obligatoria (DDL NOT NULL); lat/lng en rango geografico, opcionales;
 * - features acotadas a FEATURES_LIST y sin duplicados.
 */
export const propertySchema = z.object({
  title: z
    .string({
      required_error: "El título es obligatorio.",
      invalid_type_error: "El título debe ser un texto.",
    })
    .trim()
    .min(5, "El título debe tener al menos 5 caracteres.")
    .max(200, "El título no puede superar 200 caracteres."),
  description: optionalText(5000),
  operation: z.enum(PROPERTY_OPERATIONS, {
    errorMap: () => ({ message: "La operación debe ser venta o alquiler." }),
  }),
  property_type: z.enum(PROPERTY_TYPE_IDS, {
    errorMap: () => ({ message: "El tipo de propiedad no es válido." }),
  }),
  price: z.preprocess(
    emptyToUndefined,
    z
      .number({
        required_error: "El precio es obligatorio.",
        invalid_type_error: "El precio debe ser un número.",
      })
      .positive("El precio debe ser mayor que cero.")
      .max(999_999_999, "El precio es demasiado alto."),
  ),
  bedrooms: optionalInt(0, 100, "Los dormitorios"),
  bathrooms: optionalInt(0, 100, "Los baños"),
  surface_m2: z.preprocess(
    emptyToUndefined,
    z
      .number({ invalid_type_error: "La superficie debe ser un número." })
      .positive("La superficie debe ser mayor que cero.")
      .max(1_000_000, "La superficie es demasiado alta.")
      .nullable()
      .optional(),
  ),
  address: optionalText(300),
  city: z.preprocess(
    emptyToUndefined,
    z
      .string({
        required_error: "La ciudad es obligatoria.",
        invalid_type_error: "La ciudad debe ser un texto.",
      })
      .trim()
      .min(1, "La ciudad es obligatoria.")
      .max(120, "La ciudad no puede superar 120 caracteres."),
  ),
  zone: optionalText(120),
  lat: z.preprocess(
    emptyToUndefined,
    z
      .number({ invalid_type_error: "La latitud debe ser un número." })
      .min(-90, "La latitud está fuera de rango (-90 a 90).")
      .max(90, "La latitud está fuera de rango (-90 a 90).")
      .nullable()
      .optional(),
  ),
  lng: z.preprocess(
    emptyToUndefined,
    z
      .number({ invalid_type_error: "La longitud debe ser un número." })
      .min(-180, "La longitud está fuera de rango (-180 a 180).")
      .max(180, "La longitud está fuera de rango (-180 a 180).")
      .nullable()
      .optional(),
  ),
  features: z
    .array(z.string(), {
      invalid_type_error: "Las características deben ser una lista.",
    })
    .refine((ids) => ids.every((id) => FEATURE_ID_SET.has(id)), {
      message: "Hay características que no pertenecen al catálogo.",
    })
    .transform((ids) => [...new Set(ids)])
    .default([]),
});

/** Estado asignable desde la ficha (transicion libre, auditada en activities). */
export const propertyStatusSchema = z.enum(PROPERTY_STATUSES, {
  errorMap: () => ({ message: "El estado no es válido." }),
});

export type PropertyInput = z.output<typeof propertySchema>;
