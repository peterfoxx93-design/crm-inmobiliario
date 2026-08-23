/**
 * Validadores zod de contactos (Task 12). Campos editables del perfil
 * inline del drawer y creacion desde el dialogo "Nuevo contacto".
 */

import { z } from "zod";

const CONTACT_TYPES = ["comprador", "inquilino", "propietario"] as const;
const LEAD_SOURCES = ["web", "manual", "referido", "portal"] as const;

const phoneRegex = /^[+()\d\s.-]{6,24}$/;

export const contactSchema = z.object({
  full_name: z
    .string({ required_error: "El nombre es obligatorio." })
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(120, "El nombre no puede superar 120 caracteres."),
  contact_type: z.enum(CONTACT_TYPES, {
    errorMap: () => ({ message: "Selecciona un tipo de contacto válido." }),
  }),
  phone: z
    .string({ required_error: "El teléfono es obligatorio." })
    .trim()
    .regex(phoneRegex, "El teléfono no tiene un formato válido."),
  email: z
    .string()
    .trim()
    .email("El email no es válido.")
    .max(160)
    .optional()
    .or(z.literal("")),
  source: z.enum(LEAD_SOURCES, {
    errorMap: () => ({ message: "Selecciona un origen válido." }),
  }),
  status: z
    .enum(["nuevo", "en_seguimiento", "calificado", "descartado", "cerrado"], {
      errorMap: () => ({ message: "Estado de contacto inválido." }),
    })
    .default("nuevo"),
  budget_max: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ invalid_type_error: "El presupuesto debe ser un número." })
      .positive("El presupuesto debe ser mayor que cero.")
      .optional(),
  ),
  preferred_zones: z.array(z.string().trim().min(1)).max(20).default([]),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  consent_rgpd: z.boolean().default(false),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Esquema para actualizaciones parciales del perfil inline. */
export const contactUpdateSchema = contactSchema.partial();

export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
