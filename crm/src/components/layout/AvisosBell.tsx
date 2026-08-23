"use client";

import { Bell, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface TaskHit {
  id: string;
  title: string;
  due_date: string | null;
}

interface LeadHit {
  id: string;
  full_name: string;
  created_at: string;
}

/**
 * Campana de avisos (brief Step 2): cuenta tareas pendientes con vencimiento
 * hoy o pasado + leads `status='nuevo'` sin actividad durante >24h.
 * Tolerante a fallo: si la BD aun no existe, el contador es 0 y la lista vacia.
 */
export function AvisosBell() {
  const [tasks, setTasks] = useState<TaskHit[]>([]);
  const [leads, setLeads] = useState<LeadHit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Cada consulta se tolera por separado: error -> lista vacia.
      const [tareasRes, leadsRes] = await Promise.all([
        supabase
          .from("activities")
          .select("id,title,due_date")
          .eq("type", "tarea")
          .is("completed_at", null)
          .lte("due_date", endOfToday.toISOString())
          .order("due_date")
          .limit(8),
        supabase
          .from("contacts")
          .select("id,full_name,created_at")
          .eq("status", "nuevo")
          .lte("created_at", hace24h)
          .order("created_at")
          .limit(8),
      ]);
      if (cancelled) return;
      setTasks((tareasRes.data ?? []) as TaskHit[]);
      setLeads((leadsRes.data ?? []) as LeadHit[]);
      setLoading(false);
    }

    void load().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const count = tasks.length + leads.length;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Avisos (${count} pendientes)`}
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sm transition-colors outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted [&_svg]:size-4"
      >
        <span className="relative">
          <Bell aria-hidden />
          {count > 0 && (
            <Badge
              className="absolute -top-2 -right-2 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none text-[var(--brand-fg)]"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {count > 9 ? "9+" : count}
            </Badge>
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-semibold">Avisos</p>
        {loading ? (
          <div className="grid gap-2 py-2" aria-busy="true">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : count === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No tienes avisos pendientes. Todo al día.
          </p>
        ) : (
          <div className="grid gap-3">
            {tasks.length > 0 && (
              <section aria-label="Tareas pendientes">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden />
                  Tareas para hoy o vencidas ({tasks.length})
                </p>
                <ul className="grid gap-1">
                  {tasks.map((task) => (
                    <li key={task.id} className="truncate rounded-md px-2 py-1 text-sm hover:bg-muted">
                      {task.title || "Tarea sin título"}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {leads.length > 0 && (
              <section aria-label="Leads nuevos sin actividad">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Leads nuevos sin actividad &gt;24h ({leads.length})
                </p>
                <ul className="grid gap-1">
                  {leads.map((lead) => (
                    <li key={lead.id} className="truncate rounded-md px-2 py-1 text-sm hover:bg-muted">
                      {lead.full_name}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
