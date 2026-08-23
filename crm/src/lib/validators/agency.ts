import { z } from "zod";

import { hexColorSchema } from "@/lib/validators/my-agency";

/**
 * Esquemas de entrada del panel maestro (Task 17). Extraidos a lib/ para
 * poder testearlos en node y para que app/actions/agencies.ts ("use server")
 * solo exporte funciones de accion.
 *
 * Mapping al DDL (0001_schema.sql): `color` -> agencies.primary_color,
 * `logoUrl` -> agencies.logo_url; `slaLeadHours`, `pipelineStageDays` y
 * `webForm` se guardan dentro de agencies.settings (jsonb) con las claves
 * snake_case que consume el resto de la app (stats/SLA, Task 18 web_form).
 */

/** Longitud maxima compartida con lib/slug.ts. */
export const AGENCY_SLUG_MAX_LENGTH = 60;

/**
 * Slug manual opcional: minusculas ASCII separadas por guion unico. Si no
 * viene, la accion lo genera con slugify(name) garantizando unicidad.
 */
export const agencySlugSchema = z
  .string({
    invalid_type_error: "El identificador debe ser un texto.",
  })
  .trim()
  .max(AGENCY_SLUG_MAX_LENGTH, "El identificador no puede superar los 60 caracteres.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "El identificador solo puede tener letras minúsculas, números y guiones (p. ej. fincas-sur).",
  );

/** Horas de SLA para el primer contacto: entero sano o null (sin SLA). */
const slaLeadHoursSchema = z
  .number({
    invalid_type_error: "El SLA debe ser un número de horas.",
  })
  .int("El SLA debe ser un número entero de horas.")
  .min(0, "El SLA no puede ser negativo.")
  .max(720, "El SLA no puede superar las 720 horas (30 días).")
  .nullable()
  .optional();

/** Dias maximos por etapa del pipeline: claves subset estricto de DEAL_STAGES. */
export const pipelineStageDaysSchema = z
  .object({
    nuevo_lead: z.number().int().min(1, "Los días deben ser al menos 1.").max(365).optional(),
    calificado: z.number().int().min(1, "Los días deben ser al menos 1.").max(365).optional(),
    visita: z.number().int().min(1, "Los días deben ser al menos 1.").max(365).optional(),
    negociacion: z.number().int().min(1, "Los días deben ser al menos 1.").max(365).optional(),
    cierre: z.number().int().min(1, "Los días deben ser al menos 1.").max(365).optional(),
  })
  .strict();

/** Configuracion del formulario web publico (Task 18): forma cerrada. */
const webFormSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    showEmail: z.boolean().optional(),
    showMessage: z.boolean().optional(),
    thanksMessage: z.string().trim().max(280, "El mensaje de gracias no puede superar los 280 caracteres.").optional(),
  })
  .strict();

/** Entrada completa de upsertAgency (alta si `id` es null/ausente). */
export const upsertAgencyInputSchema = z
  .object({
    /** null/undefined = crear; uuid = editar esa agencia. */
    id: z.string().uuid("Identificador de agencia no válido.").nullable().optional(),
    name: z
      .string({ required_error: "El nombre de la agencia es obligatorio." })
      .trim()
      .min(1, "El nombre de la agencia es obligatorio.")
      .max(80, "El nombre no puede superar los 80 caracteres."),
    slug: agencySlugSchema.optional(),
    color: hexColorSchema,
    logoUrl: z
      .string()
      .url("La URL del logo no es válida.")
      .refine(
        (value) => value.toLowerCase().startsWith("https://"),
        "La URL del logo debe usar https://.",
      )
      .nullable()
      .optional(),
    slaLeadHours: slaLeadHoursSchema,
    pipelineStageDays: pipelineStageDaysSchema.optional(),
    webForm: webFormSettingsSchema.optional(),
  })
  .strict();

export type UpsertAgencyInput = z.infer<typeof upsertAgencyInputSchema>;
