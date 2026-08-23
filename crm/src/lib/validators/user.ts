import { z } from "zod";

/**
 * Roles asignables al invitar miembros de una agencia (brief Task 6).
 * `super_admin` se excluye a propósito: solo puede existir por seed/SQL
 * directo (supabase/migrations/0001_schema.sql, guard del trigger de profiles),
 * nunca desde la UI de Ajustes.
 */
export const INVITABLE_ROLES = ["admin", "agent"] as const;

/**
 * Valida los datos de una invitación antes de tocar Auth Admin.
 * - email: se normaliza (trim + minúsculas); Supabase trata emails como
 *   case-insensitive y así coinciden con `profiles` vía trigger.
 * - fullName: obligatorio; el trigger `handle_new_user` lo copia al profile.
 * - role: solo admin | agent.
 */
export const inviteSchema = z.object({
  email: z
    .string({
      required_error: "El email es obligatorio.",
      invalid_type_error: "El email debe ser un texto.",
    })
    .trim()
    .toLowerCase()
    .email("Introduce un email válido."),
  role: z.enum(INVITABLE_ROLES, {
    errorMap: () => ({ message: "El rol debe ser admin o agent." }),
  }),
  fullName: z
    .string({
      required_error: "El nombre es obligatorio.",
      invalid_type_error: "El nombre debe ser un texto.",
    })
    .trim()
    .min(1, "El nombre es obligatorio."),
});

export type InviteUserInput = z.infer<typeof inviteSchema>;
