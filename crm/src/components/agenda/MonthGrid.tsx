"use client";

/**
 * Calendario mensual de la Agenda (Task 14). Los dias con tareas llevan un
 * dot (custom `DayButton` + modifier `hasTareas`, sin tocar CSS global);
 * click en un dia navega a su vista diaria y el cambio de mes visible
 * actualiza `mes` en la URL: el estado de vista es 100% compartible.
 */

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DayButtonProps } from "react-day-picker";

import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  viewToSearchParams,
  type AgendaViewState,
} from "@/lib/agenda-view";

export interface MonthGridProps {
  /** Estado de vista actual (vista/dia ya saneados por la pagina). */
  viewState: Omit<AgendaViewState, "mes">;
  /** Mes visible `YYYY-MM`, resuelto en servidor (dia seleccionado o actual). */
  mes: string;
  /** Claves `yyyy-MM-dd` (locales) con al menos una tarea en el mes. */
  taskKeys: readonly string[];
}

/** Convierte claves `yyyy-MM-dd` a Dates locales ancladas al mediodia. */
function keysToDates(keys: readonly string[]): Date[] {
  return keys.map((key) => new Date(`${key}T12:00:00`));
}

export function MonthGrid({ viewState, mes, taskKeys }: MonthGridProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const state: AgendaViewState = { ...viewState, mes };
  const monthDate = new Date(`${mes}-01T12:00:00`);
  const selectedDate = viewState.dia
    ? new Date(`${viewState.dia}T12:00:00`)
    : undefined;

  // Matcher del modifier: las fechas con tareas.
  const hasTareas = useMemo(() => keysToDates(taskKeys), [taskKeys]);

  function navigate(sp: URLSearchParams) {
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `/agenda?${qs}` : "/agenda"));
  }

  function pushDay(day: Date) {
    const sp = viewToSearchParams(state, "dia");
    sp.set("dia", format(day, "yyyy-MM-dd", { locale: es }));
    // El dia clicado puede ser un outside-day de otro mes: se sincroniza
    // `mes` para que la consulta del rango lo incluya siempre.
    sp.set("mes", format(day, "yyyy-MM", { locale: es }));
    navigate(sp);
  }

  const components = useMemo(
    () => ({
      // CalendarDayButton exige day/modifiers en su firma y los separa
      // antes del DOM; aqui solo anadimos el dot si el modifier activa.
      DayButton: ({ day, modifiers, ...dayButtonProps }: DayButtonProps) => (
        <CalendarDayButton day={day} modifiers={modifiers} {...dayButtonProps}>
          {dayButtonProps.children}
          {modifiers.hasTareas ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-1 mx-auto size-1 rounded-full bg-primary"
            />
          ) : null}
        </CalendarDayButton>
      ),
    }),
    [],
  );

  return (
    <div className="flex justify-center rounded-xl border bg-card p-4">
      <Calendar
        mode="single"
        locale={es}
        weekStartsOn={1}
        month={monthDate}
        selected={selectedDate}
        modifiers={{ hasTareas }}
        components={components}
        onSelect={(day) => {
          if (!day) return;
          pushDay(day);
        }}
        onMonthChange={(month) => {
          const sp = viewToSearchParams(state, "mes");
          sp.set("mes", format(month, "yyyy-MM", { locale: es }));
          navigate(sp);
        }}
      />
    </div>
  );
}
