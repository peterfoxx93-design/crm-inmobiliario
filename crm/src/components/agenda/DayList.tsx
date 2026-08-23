"use client";

/**
 * Lista cronologica del dia seleccionado (Task 14). Pendientes arriba y
 * completadas debajo tachadas; cada fila permite completar/reabrir con
 * update optimista (patron KanbanBoard: override derivado de props, rollback
 * implicito al limpiar el pendiente si la action falla), reprogramar rapido
 * (+1 dia o elegir fecha en el calendario) y editar via TaskDialog.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";

import { completeTask, rescheduleTask, uncompleteTask } from "@/app/actions/tasks";
import {
  TaskDialog,
  type ContactOption,
  type TaskPropertyOption,
} from "@/components/agenda/TaskDialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addDaysIso, type TaskWithRelations } from "@/lib/agenda";
import { cn } from "@/lib/utils";

export interface DayListProps {
  /** Tareas del dia seleccionado, ya ordenadas cronologicamente. */
  tasks: readonly TaskWithRelations[];
  contactsOptions: readonly ContactOption[];
  propertyOptions: readonly TaskPropertyOption[];
}

/** Fila visible = tarea del servidor + override de toggle en vuelo. */
type DayListRow = TaskWithRelations & { pendingDone?: boolean };

export function DayList({
  tasks,
  contactsOptions,
  propertyOptions,
}: DayListProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [pendingToggles, setPendingToggles] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Estado optimista DERIVADO de props (patron KanbanBoard): solo el toggle
  // en vuelo; al llegar props frescas tras refresh desaparece solo.
  const rows = useMemo<DayListRow[]>(
    () =>
      tasks.map((task) => {
        const pendingDone = pendingToggles.get(task.id);
        if (pendingDone === undefined) return task;
        return {
          ...task,
          completed_at: pendingDone
            ? (task.completed_at ?? new Date().toISOString())
            : null,
        };
      }),
    [tasks, pendingToggles],
  );

  const pendingRows = rows.filter((row) => row.completed_at === null);
  const completedRows = rows.filter((row) => row.completed_at !== null);

  function clearPending(taskId: string) {
    setPendingToggles((prev) => {
      if (!prev.has(taskId)) return prev;
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
  }

  async function persistToggle(row: DayListRow) {
    const target = row.completed_at === null;
    setPendingToggles((prev) => new Map(prev).set(row.id, target));

    const result = await (target ? completeTask(row.id) : uncompleteTask(row.id));
    if (!result.ok) {
      // Rollback implicito: al limpiar el override la fila vuelve al estado real.
      toast.error(result.error);
      clearPending(row.id);
      return;
    }
    toast.success(target ? "Tarea completada." : "Tarea reabierta.");
    startRefresh(() => router.refresh());
  }

  async function persistReschedule(taskId: string, dueIso: string) {
    const result = await rescheduleTask(taskId, dueIso);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tarea reprogramada.");
    startRefresh(() => router.refresh());
  }

  function openEdit(task: TaskWithRelations) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <section aria-label="Tareas pendientes del día" className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Pendientes ({pendingRows.length})
        </h2>
        {pendingRows.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            Sin tareas pendientes para este día.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {pendingRows.map((row) => (
              <li key={row.id}>
                <TaskRow
                  row={row}
                  onToggle={() => void persistToggle(row)}
                  onEdit={() => openEdit(row)}
                  onReschedule={(dueIso) => void persistReschedule(row.id, dueIso)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {completedRows.length > 0 && (
        <section aria-label="Tareas completadas del día" className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Completadas ({completedRows.length})
          </h2>
          <ul className="space-y-1.5">
            {completedRows.map((row) => (
              <li key={row.id}>
                <TaskRow
                  row={row}
                  onToggle={() => void persistToggle(row)}
                  onEdit={() => openEdit(row)}
                  onReschedule={(dueIso) => void persistReschedule(row.id, dueIso)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <TaskDialog
        key={editingTask?.id ?? "editar"}
        task={editingTask}
        contactsOptions={contactsOptions}
        propertyOptions={propertyOptions}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

interface TaskRowProps {
  row: DayListRow;
  onToggle: () => void;
  onEdit: () => void;
  /** Recibe el nuevo vencimiento como instante ISO. */
  onReschedule: (dueIso: string) => void;
}

function TaskRow({ row, onToggle, onEdit, onReschedule }: TaskRowProps) {
  const done = row.completed_at !== null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-3 py-2.5 transition-opacity",
        done && "opacity-70",
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={onToggle}
        disabled={row.pendingDone !== undefined}
        aria-label={done ? `Reabrir ${row.title}` : `Completar ${row.title}`}
      />

      <time
        dateTime={row.due_date ?? undefined}
        className={cn(
          "w-12 shrink-0 text-sm tabular-nums",
          done && "line-through text-muted-foreground",
        )}
      >
        {row.due_date ? format(new Date(row.due_date), "HH:mm") : "—:—"}
      </time>

      <button
        type="button"
        onClick={onEdit}
        title="Editar tarea"
        className={cn(
          "min-w-0 flex-1 cursor-pointer truncate text-left text-sm underline-offset-2 hover:underline",
          done && "line-through text-muted-foreground",
        )}
      >
        {row.title}
      </button>

      <div className="flex min-w-0 items-center gap-2 truncate text-xs text-muted-foreground">
        {row.contact && (
          <Link
            href={`/contactos?q=${encodeURIComponent(row.contact.full_name)}`}
            className="shrink-0 underline-offset-2 hover:text-foreground hover:underline"
          >
            {row.contact.full_name}
          </Link>
        )}
        {row.property && (
          <Link
            href={`/propiedades/${row.property.id}`}
            className="max-w-40 shrink-0 truncate underline-offset-2 hover:text-foreground hover:underline"
          >
            {row.property.title}
          </Link>
        )}
      </div>

      {!done && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!row.due_date}
            onClick={() => {
              if (!row.due_date) return;
              onReschedule(addDaysIso(row.due_date, 1));
            }}
            title="Aplazar un día conservando la hora"
          >
            <CalendarPlusIcon data-icon="inline-start" aria-hidden />
            +1 día
          </Button>

          <ReschedulePopover
            currentDate={row.due_date}
            onPickDate={(day) =>
              onReschedule(withCurrentTime(day, row.due_date))
            }
          />
        </div>
      )}
    </div>
  );
}

/** Nuevo dia conservando la hora actual del vencimiento (si la tiene). */
function withCurrentTime(day: Date, currentIso: string | null): string {
  const base =
    currentIso && !Number.isNaN(new Date(currentIso).getTime())
      ? new Date(currentIso)
      : day;
  const next = new Date(day);
  next.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return next.toISOString();
}

function ReschedulePopover({
  currentDate,
  onPickDate,
}: {
  currentDate: string | null;
  onPickDate: (day: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = currentDate ? new Date(currentDate) : null;
  const validDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Elegir nueva fecha"
        title="Reprogramar eligiendo fecha"
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sm transition-colors outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted [&_svg]:size-4"
      >
        <CalendarPlusIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <Calendar
          mode="single"
          locale={es}
          weekStartsOn={1}
          selected={validDate}
          defaultMonth={validDate}
          onSelect={(day) => {
            if (!day) return;
            setOpen(false);
            onPickDate(day);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
