import "server-only";

import type { TaskWithRelations } from "@/lib/agenda";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Queries server-only de la Agenda (Task 14). La RLS aísla por agencia;
 * los embeds usan las FK con nombre por defecto del DDL (inline sin nombre
 * custom ⇒ `activities_contact_id_fkey` / `activities_property_id_fkey`).
 */

export type { TaskWithRelations };

/**
 * Lista las tareas (activities con type='tarea') cuyo due_date cae dentro
 * del rango `[from, to)` de la agencia del actor. Orden cronológico
 * ascendente por due_date; techo defensivo de 500 filas.
 */
export async function listTasks(range: {
  from: string;
  to: string;
}): Promise<TaskWithRelations[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("activities")
    .select(
      [
        "*",
        "contact:contacts!activities_contact_id_fkey(full_name)",
        "property:properties!activities_property_id_fkey(id,title)",
      ].join(","),
    )
    .eq("type", "tarea")
    .gte("due_date", range.from)
    .lt("due_date", range.to)
    .order("due_date", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(`No se han podido cargar las tareas: ${error.message}`);
  }

  return ((data ?? []) as unknown as TaskWithRelations[]);
}
