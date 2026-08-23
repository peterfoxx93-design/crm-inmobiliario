"use client";

/**
 * Boton "Nueva tarea" de la Agenda (Task 14): abre el TaskDialog en modo
 * creacion precargando el dia seleccionado (patron NewContactButton).
 */

import { useState } from "react";
import { Plus } from "lucide-react";

import { TaskDialog, type ContactOption, type TaskPropertyOption } from "@/components/agenda/TaskDialog";
import { Button } from "@/components/ui/button";

export interface NewTaskButtonProps {
  contactsOptions: readonly ContactOption[];
  propertyOptions: readonly TaskPropertyOption[];
  /** Dia seleccionado `yyyy-MM-dd`; precarga la fecha-hora del dialogo. */
  defaultDate?: string;
}

export function NewTaskButton({
  contactsOptions,
  propertyOptions,
  defaultDate,
}: NewTaskButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden />
        Nueva tarea
      </Button>
      <TaskDialog
        key={`nueva-${defaultDate ?? "hoy"}`}
        contactsOptions={contactsOptions}
        propertyOptions={propertyOptions}
        defaultDate={defaultDate}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
