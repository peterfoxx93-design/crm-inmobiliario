"use client";

/**
 * Dialogo de creacion/edicion de tareas (Task 14). Estados simples como
 * ActivityComposer/DealCreateDialog (formulario corto con un unico submit,
 * sin RHF). El padre lo remonta con `key` distinta por tarea, de modo que
 * los useState iniciales garantizan un formulario limpio sin efectos.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { toast } from "sonner";

import { addActivity } from "@/app/actions/contacts";
import { updateTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TaskWithRelations } from "@/lib/agenda";
import { cn } from "@/lib/utils";

export interface ContactOption {
  id: string;
  full_name: string;
}

export interface TaskPropertyOption {
  id: string;
  title: string;
  reference: string;
}

export interface TaskDialogProps {
  contactsOptions: readonly ContactOption[];
  propertyOptions: readonly TaskPropertyOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo edicion: tarea a editar; ausente/null = creacion. */
  task?: TaskWithRelations | null;
  /** Dia seleccionado en la agenda (`yyyy-MM-dd`) para precargar al crear. */
  defaultDate?: string;
}

/** Valor para `<Input type="datetime-local">` desde el due_date guardado. */
function toDatetimeLocal(iso: string | null, fallbackDate?: string): string {
  if (iso) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd'T'HH:mm", { locale: es });
    }
  }
  // Al crear desde un dia concreto se sugiere las 09:00 de ese dia.
  return fallbackDate ? `${fallbackDate}T09:00` : "";
}

export function TaskDialog({
  contactsOptions,
  propertyOptions,
  open,
  onOpenChange,
  task = null,
  defaultDate,
}: TaskDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState(task?.title ?? "");
  const [dueLocal, setDueLocal] = useState(() =>
    toDatetimeLocal(task?.due_date ?? null, defaultDate),
  );
  const [contactId, setContactId] = useState(task?.contact_id ?? "");
  const [propertyId, setPropertyId] = useState(task?.property_id ?? "");
  const [notes, setNotes] = useState(task?.body ?? "");
  const [contactComboOpen, setContactComboOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const editing = Boolean(task);
  const selectedContact =
    contactsOptions.find((option) => option.id === contactId) ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !dueLocal) return;

    // datetime-local se interpreta en hora LOCAL del navegador y se envia
    // como instante ISO explicito (sin ambiguedad de zona en Postgres).
    const dueIso = new Date(dueLocal).toISOString();
    setIsPending(true);

    const result = editing
      ? await updateTask(task!.id, {
          title: title.trim(),
          dueDate: dueIso,
          contactId: contactId || null,
          propertyId: propertyId || null,
          notes: notes.trim(),
        })
      : await addActivity({
          type: "tarea",
          title: title.trim(),
          body: notes.trim() || undefined,
          contactId: contactId || undefined,
          propertyId: propertyId || undefined,
          dueDate: dueIso,
        });

    setIsPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(editing ? "Tarea actualizada." : "Tarea creada.");
    onOpenChange(false);
    router.refresh();
  }

  const submitLabel = isPending
    ? "Guardando…"
    : editing
      ? "Guardar cambios"
      : "Crear tarea";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Modifica los datos o reprograma su vencimiento."
              : "Quedará añadida a la agenda con recordatorio de vencimiento."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Llamar al propietario"
              required
              maxLength={160}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="task-due">Fecha y hora</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueLocal}
              onChange={(event) => setDueLocal(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Contacto (opcional)</Label>
            <Popover open={contactComboOpen} onOpenChange={setContactComboOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={contactComboOpen}
                    className="w-full justify-between font-normal"
                  />
                }
              >
                {selectedContact ? (
                  selectedContact.full_name
                ) : (
                  <span className="text-muted-foreground">Sin contacto</span>
                )}
                <ChevronsUpDownIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Command>
                  <CommandInput placeholder="Buscar contacto…" />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="Sin contacto"
                        onSelect={() => {
                          setContactId("");
                          setContactComboOpen(false);
                        }}
                      >
                        <CheckIcon
                          className={cn(
                            "mr-1 size-4",
                            contactId === "" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Sin contacto
                      </CommandItem>
                      {contactsOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.full_name}
                          onSelect={() => {
                            setContactId(option.id);
                            setContactComboOpen(false);
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              "mr-1 size-4",
                              option.id === contactId ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {option.full_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label>Propiedad (opcional)</Label>
            <Select
              value={propertyId || null}
              onValueChange={(value) => setPropertyId(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sin propiedad" />
              </SelectTrigger>
              <SelectContent>
                {propertyOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.reference} · {option.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="task-notes">Notas</Label>
            <Textarea
              id="task-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Detalles, teléfono, acuerdos…"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !dueLocal}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
