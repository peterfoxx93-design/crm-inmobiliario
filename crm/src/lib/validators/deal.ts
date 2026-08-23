/**
 * Validadores zod del pipeline (Task 13). Viven fuera de "use server"
 * para poder exportarlos y testearlos como unidades puras.
 */

import { z } from "zod";

export const dealIdSchema = z.string().uuid("Identificador no válido.");

export const dealStageSchema = z.enum(
  ["nuevo_lead", "calificado", "visita", "negociacion", "cierre"],
  { errorMap: () => ({ message: "Etapa del pipeline no válida." }) },
);

export const updateDealSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(4000, "Las notas no pueden superar 4000 caracteres.")
    .optional(),
  // El drawer envia el importe como string del input: se coacciona a numero.
  // "" o null limpian el importe; undefined = no tocar el campo.
  value: z.preprocess(
    (v) => {
      if (v === "" || v === null) return null;
      if (v === undefined) return undefined;
      return typeof v === "string" || typeof v === "number" ? Number(v) : v;
    },
    z
      .union(
        [
          z
            .number({ invalid_type_error: "El importe debe ser un número." })
            .positive("El importe debe ser mayor que cero."),
          z.null(),
        ],
        { invalid_type_error: "El importe debe ser un número." },
      )
      .optional(),
  ),
});

export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const closeDealSchema = z
  .object({
    won: z.boolean({
      required_error: "Indica si la oferta se ha ganado o perdido.",
    }),
    lostReason: z
      .string()
      .trim()
      .min(1, "Indica el motivo de la pérdida.")
      .max(500, "El motivo no puede superar 500 caracteres.")
      .optional(),
  })
  .refine((data) => data.won || (data.lostReason ?? "").length > 0, {
    message: "Indica el motivo de la pérdida.",
    path: ["lostReason"],
  });
