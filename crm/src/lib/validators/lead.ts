import { z } from "zod";

/**
 * Esquema y decisiones puras del endpoint publico de captacion de leads
 * (Task 18). Extraidos a lib/ para poder testearlos en node y mantener el
 * route handler como mera orquestacion.
 *
 * Contrato del POST /api/public/leads/[slug]:
 *   { fullName, phone, email?, message?, companyUrl? }
 * `companyUrl` es HONEYPOT: los bots rellenan todos los campos; si llega con
 * contenido se responde exito falso (200) sin tocar la base de datos.
 */

/** Mismo formato flexible internacional que lib/validators/contact.ts. */
const phoneRegex = /^[+()\d\s.-]{6,32}$/;

export const publicLeadSchema = z
  .object({
    fullName: z
      .string({
        required_error: "El nombre es obligatorio.",
        invalid_type_error: "El nombre debe ser un texto.",
      })
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(120, "El nombre no puede superar los 120 caracteres."),
    phone: z
      .string({
        required_error: "El teléfono es obligatorio.",
        invalid_type_error: "El teléfono debe ser un texto.",
      })
      .trim()
      .regex(phoneRegex, "El teléfono no tiene un formato válido."),
    email: z
      .string({ invalid_type_error: "El email debe ser un texto." })
      .trim()
      .email("El email no es válido.")
      .max(160)
      .optional()
      .or(z.literal("")),
    message: z
      .string({ invalid_type_error: "El mensaje debe ser un texto." })
      .trim()
      .max(2000, "El mensaje no puede superar los 2000 caracteres.")
      .optional()
      .or(z.literal("")),
    /** HONEYPOT: nunca se persiste; solo se comprueba si viene relleno. */
    companyUrl: z
      .string({ invalid_type_error: "Datos no válidos." })
      .max(2048)
      .optional(),
  })
  .strict();

export type PublicLeadInput = z.infer<typeof publicLeadSchema>;

/**
 * Decision honeypot: true solo si `companyUrl` trae contenido real tras
 * recortar (los formularios legitimos lo envian vacio y oculto).
 */
export function isHoneypotFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Decision de upsert por telefono dentro de la agencia:
//   - contacto NUEVO   -> INSERT en contacts con source='web' y consentimiento
//                         RGPD sellado (consent_rgpd=true, consent_at=now).
//   - contacto EXISTE  -> actividad de sistema con el mensaje del lead.
// El DDL (0001_schema.sql) fija source in ('web','manual','referido','portal')
// y type in ('llamada','email','whatsapp','nota','visita','tarea','sistema').
// ---------------------------------------------------------------------------

/** Datos ya validados por publicLeadSchema (sin el honeypot). */
export interface PublicLeadData {
  fullName: string;
  phone: string;
  email?: string;
  message?: string;
}

/** Fila lista para insertar en public.contacts (nombres de columna reales). */
export interface NewContactRow {
  agency_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  source: "web";
  consent_rgpd: boolean;
  consent_at: string;
}

/** Actividad de sistema lista para insertar en public.activities. */
export interface LeadActivityRow {
  contact_id: string;
  type: "sistema";
  title: string;
  body: string;
}

export type LeadUpsertDecision =
  | { kind: "nuevo"; contact: NewContactRow }
  | { kind: "existente"; activity: LeadActivityRow };

const LEAD_ACTIVITY_TITLE = "Lead recibido desde la web";

export function decideLeadUpsert(
  existingContactId: string | null | undefined,
  agencyId: string,
  lead: PublicLeadData,
  nowIso: string,
): LeadUpsertDecision {
  if (existingContactId) {
    const bodyParts = [
      "Nuevo intento de contacto desde el formulario web.",
      lead.message ? `Mensaje: ${lead.message}` : null,
      lead.email ? `Email facilitado: ${lead.email}` : null,
    ].filter((part): part is string => part !== null);

    return {
      kind: "existente",
      activity: {
        contact_id: existingContactId,
        type: "sistema",
        title: LEAD_ACTIVITY_TITLE,
        body: bodyParts.join(" "),
      },
    };
  }

  return {
    kind: "nuevo",
    contact: {
      agency_id: agencyId,
      full_name: lead.fullName,
      phone: lead.phone,
      email: lead.email ? lead.email : null,
      notes: lead.message ? lead.message : null,
      source: "web",
      consent_rgpd: true,
      consent_at: nowIso,
    },
  };
}
