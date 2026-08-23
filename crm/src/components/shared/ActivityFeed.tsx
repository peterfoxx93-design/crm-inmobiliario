"use client";

/**
 * Timeline unificada de actividades (Task 12): agrupada por dia, icono y
 * color por tipo. Reutilizada en el drawer de contacto (por contact_id)
 * y en la tab Visitas de la ficha de propiedad (por property_id).
 */

import {
  FileText,
  Info,
  ListTodo,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { groupActivitiesByDay } from "@/lib/feed";
import { ACTIVITY_TYPE_META } from "@/lib/constants";
import type { ActivityRow, ActivityType } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";

const ICONS: Record<ActivityType, LucideIcon> = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  nota: FileText,
  visita: MapPin,
  tarea: ListTodo,
  sistema: Info,
};

export interface ActivityFeedProps {
  activities: readonly ActivityRow[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ActivityFeed({
  activities,
  emptyTitle = "Sin actividad todavía",
  emptyDescription = "Las llamadas, notas, visitas y cambios aparecerán aquí.",
}: ActivityFeedProps) {
  if (activities.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const groups = groupActivitiesByDay(activities);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h4>
          <ol className="space-y-3">
            {group.items.map((activity) => {
              const meta = ACTIVITY_TYPE_META[activity.type];
              const Icon = ICONS[activity.type] ?? Info;
              return (
                <li key={activity.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label} · {formatRelativeTime(activity.created_at)}
                      {activity.author_name ? ` · ${activity.author_name}` : ""}
                      {activity.due_date ? ` · vence ${activity.due_date}` : ""}
                    </p>
                    {activity.body ? (
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {activity.body}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
