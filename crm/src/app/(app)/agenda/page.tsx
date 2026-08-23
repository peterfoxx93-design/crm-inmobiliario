import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutList,
} from "lucide-react";

import { DayList } from "@/components/agenda/DayList";
import { MonthGrid } from "@/components/agenda/MonthGrid";
import { NewTaskButton } from "@/components/agenda/NewTaskButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { Button } from "@/components/ui/button";
import {
  buildMonthRange,
  groupTasksByDay,
  monthOfDayKey,
  shiftDayKey,
  todayKey,
} from "@/lib/agenda";
import {
  parseAgendaView,
  viewToSearchParams,
  type AgendaViewState,
  type AgendaViewType,
} from "@/lib/agenda-view";
import { listContactOptions } from "@/lib/queries/contacts";
import { listPropertyOptions } from "@/lib/queries/properties";
import { listTasks } from "@/lib/queries/tasks";

export const metadata: Metadata = {
  title: "Agenda · CRM Inmobiliario",
};

interface PageProps {
  /** Next 16: searchParams es una Promise; se resuelve y se delega. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Agenda de tareas (Task 14): vista Dia|Mes por URL (`vista`, `dia`, `mes`).
 * Se carga SIEMPRE el mes completo del mes visible: la vista diaria filtra
 * del mismo resultado y el mensual pinta sus dots sin segundas queries.
 * Boundary Suspense claveado por querystring, como propiedades/contactos.
 */
export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  // Clave estable del boundary Suspense: cualquier cambio de querystring
  // remonta el boundary y muestra el fallback.
  const keyParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) keyParams.set(key, first);
  }
  const view = parseAgendaView(params);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Tareas y vencimientos de la agencia, por día o por mes.
          </p>
        </div>
        <ViewToggle state={view} />
      </div>

      <Suspense key={keyParams.toString()} fallback={<TableSkeleton rows={6} columns={3} />}>
        <AgendaContent view={view} />
      </Suspense>
    </div>
  );
}

async function AgendaContent({
  view,
}: {
  view: AgendaViewState;
}) {
  // El dia efectivo es el seleccionado o hoy; el mes visible, su mes.
  const dia = view.dia ?? todayKey();
  const mes =
    view.mes ?? monthOfDayKey(dia) ?? monthOfDayKey(todayKey()) ?? "1970-01";

  let tasks;
  let contactOptions;
  let propertyOptions;
  try {
    [tasks, contactOptions, propertyOptions] = await Promise.all([
      listTasks(buildMonthRange(...parseMonth(mes))),
      listContactOptions(),
      listPropertyOptions(),
    ]);
  } catch {
    // Fallo de red / BD sin migrar: respuesta amable en lugar de error 500.
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se ha podido cargar la agenda"
        description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
      />
    );
  }

  const groups = groupTasksByDay(tasks);
  const taskKeys = [...groups.keys()];
  const dayTasks = groups.get(dia) ?? [];
  const isEmpty = tasks.length === 0;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"} en{" "}
          {new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
            .format(new Date(`${mes}-01T12:00:00`))}
        </p>
        {/* Con periodo vacio el CTA vive en el EmptyState (sin duplicar boton). */}
        {!isEmpty && (
          <NewTaskButton
            contactsOptions={contactOptions}
            propertyOptions={propertyOptions}
            defaultDate={dia}
          />
        )}
      </div>

      {view.vista === "dia" ? (
        <>
          <DayNavigation dia={dia} mes={mes} />
          <DayList
            key={dia}
            tasks={dayTasks}
            contactsOptions={contactOptions}
            propertyOptions={propertyOptions}
          />
        </>
      ) : (
        <MonthGrid viewState={{ vista: "mes", dia }} mes={mes} taskKeys={taskKeys} />
      )}

      {isEmpty && (
        <EmptyState
          icon={CalendarDays}
          title="No hay tareas en este periodo"
          description="Crea tu primera tarea para organizar visitas y seguimientos."
          cta={
            <NewTaskButton
              contactsOptions={contactOptions}
              propertyOptions={propertyOptions}
              defaultDate={dia}
            />
          }
        />
      )}
    </>
  );
}

/** `YYYY-MM` -> [year, month] validos para buildMonthRange; default actual. */
function parseMonth(
  mes: string,
): [number, number] {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) {
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1];
  }
  return [y, m];
}

/**
 * Toggle Dia|Mes: enlaces que conservan `dia`/`mes` y solo intercambian
 * `vista` (patron ViewToggle de propiedades).
 */
function ViewToggle({ state }: { state: AgendaViewState }) {
  function hrefFor(target: AgendaViewType): string {
    const sp = viewToSearchParams(state, target);
    const qs = sp.toString();
    return qs ? `/agenda?${qs}` : "/agenda";
  }

  return (
    <div
      role="group"
      aria-label="Vista de agenda"
      className="flex overflow-hidden rounded-md border"
    >
      <Link
        href={hrefFor("dia")}
        aria-current={state.vista === "dia" ? "page" : undefined}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
          state.vista === "dia"
            ? "bg-primary text-primary-foreground"
            : "bg-background hover:bg-muted"
        }`}
      >
        <LayoutList aria-hidden className="size-4" />
        Día
      </Link>
      <Link
        href={hrefFor("mes")}
        aria-current={state.vista === "mes" ? "page" : undefined}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
          state.vista === "mes"
            ? "bg-primary text-primary-foreground"
            : "bg-background hover:bg-muted"
        }`}
      >
        <CalendarDays aria-hidden className="size-4" />
        Mes
      </Link>
    </div>
  );
}

/** Navegacion ‹ dia › de la vista diaria (links ±1 dia conservando mes). */
function DayNavigation({ dia, mes }: { dia: string; mes: string }) {
  const prev = shiftDayKey(dia, -1);
  const next = shiftDayKey(dia, 1);

  function hrefFor(key: string): string {
    const sp = new URLSearchParams({ dia: key });
    if (monthOfDayKey(key) !== mes) sp.set("mes", monthOfDayKey(key) ?? mes);
    return `/agenda?${sp.toString()}`;
  }

  return (
    <nav
      aria-label="Navegación de días"
      className="flex items-center justify-between gap-2 rounded-xl border bg-card px-2 py-2"
    >
      <Button variant="ghost" size="sm" render={<Link href={hrefFor(prev)} />}>
        <ChevronLeft data-icon="inline-start" aria-hidden />
        Anterior
      </Button>
      <time dateTime={dia} className="text-sm font-medium capitalize">
        {formatDayLabel(dia)}
      </time>
      <Button variant="ghost" size="sm" render={<Link href={hrefFor(next)} />}>
        Siguiente
        <ChevronRight data-icon="inline-end" aria-hidden />
      </Button>
    </nav>
  );
}

/** Etiqueta larga del dia: Hoy / Mañana / Ayer / «lunes, 24 de agosto». */
function formatDayLabel(key: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  const today = todayKey();
  if (key === today) return "Hoy";
  if (key === shiftDayKey(today, 1)) return "Mañana";
  if (key === shiftDayKey(today, -1)) return "Ayer";

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${key}T12:00:00`));
}
