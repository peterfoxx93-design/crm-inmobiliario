import Link from "next/link";
import { AlertTriangle, CalendarClock, ListTodo } from "lucide-react";

import { dayKey } from "@/lib/agenda";
import { formatRelativeTime } from "@/lib/format";
import type { SlaCandidateContact, TodayTask } from "@/lib/dashboard";

/**
 * Panel del dia (Task 15): «Tareas hoy» y «Alertas SLA».
 * Convenciones de enlace existentes:
 * - Tarea -> /agenda?dia=<clave local> (la agenda es la ficha de la tarea;
 *   las actividades no tienen ruta propia).
 * - Lead SLA -> /contactos?q=<nombre> (patron ya usado por la agenda en
 *   DayList: el drawer de contacto no es direccionable por URL).
 */

const MAX_ROWS = 8;

function TaskRow({ task }: { task: TodayTask }) {
  const day = task.due_date ? dayKey(task.due_date) : "";
  return (
    <li>
      <Link
        href={day ? `/agenda?dia=${day}` : "/agenda"}
        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{task.title}</span>
          {task.contact_name && (
            <span className="block truncate text-xs text-muted-foreground">
              {task.contact_name}
            </span>
          )}
        </span>
        <time
          dateTime={task.due_date ?? undefined}
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
        >
          {formatRelativeTime(task.due_date ?? "")}
        </time>
      </Link>
    </li>
  );
}

function SlaRow({ lead }: { lead: SlaCandidateContact }) {
  return (
    <li>
      <Link
        href={`/contactos?q=${encodeURIComponent(lead.full_name)}`}
        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {lead.full_name}
          </span>
          <span className="block text-xs text-red-600">
            Sin seguimiento desde el alta
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <AlertTriangle aria-hidden className="size-3" />
          SLA
        </span>
      </Link>
    </li>
  );
}

interface TodayPanelProps {
  tareasHoy: TodayTask[];
  tareasVencidas: TodayTask[];
  leadsSla: SlaCandidateContact[];
}

export function TodayPanel({
  tareasHoy,
  tareasVencidas,
  leadsSla,
}: TodayPanelProps) {
  // Vencidas primero (son lo mas urgente), luego las de hoy.
  const tareas = [...tareasVencidas, ...tareasHoy].slice(0, MAX_ROWS);
  const alertas = leadsSla.slice(0, MAX_ROWS);

  return (
    <section
      aria-label="Panel del día"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {/* Tareas hoy (+ vencidas de los ultimos 30 dias) */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <ListTodo aria-hidden className="size-4 text-muted-foreground" />
            Tareas hoy
          </h2>
          {tareasVencidas.length > 0 && (
            <span
              title={`Incluye ${tareasVencidas.length} ${
                tareasVencidas.length === 1 ? "tarea vencida" : "tareas vencidas"
              }`}
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
            >
              {tareasVencidas.length}{" "}
              {tareasVencidas.length === 1 ? "vencida" : "vencidas"}
            </span>
          )}
        </div>
        {tareas.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            No tienes tareas pendientes para hoy. Buen momento para adelantar
            seguimientos.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {tareas.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
        <Link
          href="/agenda"
          className="mt-2 inline-block px-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Ver agenda completa
        </Link>
      </div>

      {/* Alertas SLA de leads nuevos sin seguimiento */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarClock aria-hidden className="size-4 text-muted-foreground" />
            Alertas SLA
          </h2>
          {alertas.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {alertas.length}{" "}
              {alertas.length === 1 ? "lead sin atender" : "leads sin atender"}
            </span>
          )}
        </div>
        {alertas.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            Todos los leads nuevos están dentro del plazo de respuesta. ¡Así se
            hace!
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {alertas.map((lead) => (
              <SlaRow key={lead.id} lead={lead} />
            ))}
          </ul>
        )}
        <Link
          href="/contactos?status=nuevo"
          className="mt-2 inline-block px-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Ver leads nuevos
        </Link>
      </div>
    </section>
  );
}
