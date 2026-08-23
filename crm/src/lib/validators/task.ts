/**
 * Validadores zod de la Agenda (Task 14). Viven fuera de "use server"
 * para poder exportarlos y testearlos como unidades puras.
 */

import { z } from "zod";

export const taskIdSchema = z.string().uuid("Identificador no válido.");

/** Instante ISO parseable (el cliente envia siempre new Date(...).toISOString()). */
export const taskDueDateSchema = z
  .string({ required_error: "La fecha no es válida." })
  .min(1, "La fecha no es válida.")
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "La fecha no es válida.",
  });

export const rescheduleTaskSchema = z.object({
  dueDate: taskDueDateSchema,
});

export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;

/**
 * Actualizacion parcial de una tarea: undefined = no tocar el campo,
 * null en contactId/propertyId = desvincular (limpiar la relacion).
 */
export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es obligatorio.")
    .max(160, "El título no puede superar 160 caracteres.")
    .optional(),
  dueDate: taskDueDateSchema.optional(),
  contactId: z.string().uuid("Contacto no válido.").nullable().optional(),
  propertyId: z.string().uuid("Propiedad no válida.").nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(4000, "Las notas no pueden superar 4000 caracteres.")
    .optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
