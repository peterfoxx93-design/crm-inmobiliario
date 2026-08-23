"use client";

/**
 * Card de deal del tablero Kanban (Task 13 Step 2): miniatura 16:9 de la
 * propiedad, contacto, importe, avatar del agente y contador de dias en
 * etapa. Borde rojo si supera el SLA configurado por la agencia.
 * En movil (<md) no hay drag: un Select discreto cambia la etapa.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEAL_STAGES } from "@/lib/constants";
import { daysInStage, formatCurrency, isStageOverdue } from "@/lib/format";
import type { DealWithRelations } from "@/lib/pipeline";
import type { DealStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface KanbanCardProps {
  deal: DealWithRelations;
  /** Umbral SLA (dias) de la etapa actual; undefined = sin alerta. */
  slaDays?: number;
  disabled?: boolean;
  onOpen: (dealId: string) => void;
  onMove: (dealId: string, stage: DealStage) => void;
}

function initials(fullName: string | null | undefined): string {
  if (!fullName) return "—";
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function KanbanCard({ deal, slaDays, disabled, onOpen, onMove }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id, disabled });

  const days = daysInStage(deal.stage_updated_at);
  const overdue =
    slaDays !== undefined && slaDays !== null && isStageOverdue(deal.stage_updated_at, slaDays);
  const thumbnail = deal.property?.property_images?.[0]?.url ?? null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group rounded-xl border bg-card p-2 shadow-xs transition-shadow",
        overdue && "border-l-4 border-l-red-500 ring-1 ring-red-200",
        isDragging ? "z-10 opacity-90 ring-2 ring-primary" : "hover:shadow-md",
      )}
    >
      {/* Zona de arrastre + click para abrir el drawer. El guard temporal
          evita abrir el drawer tras soltar una tarjeta arrastrada. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Abrir oferta de ${deal.contact?.full_name ?? "contacto"}`}
        onClick={() => onOpen(deal.id)}
        className="block w-full cursor-grab touch-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative mb-2 aspect-video overflow-hidden rounded-lg bg-muted">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- URLs de Storage sin remotePatterns configurado
            <img src={thumbnail} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
              Sin foto
            </span>
          )}
        </div>

        <p className="truncate text-sm font-medium">{deal.contact?.full_name ?? "Sin contacto"}</p>
        <p className="text-sm font-semibold text-muted-foreground">
          {deal.value !== null ? formatCurrency(deal.value) : "Sin presupuesto"}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              overdue ? "font-medium text-red-600" : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-3" aria-hidden />
            {days} {days === 1 ? "día" : "días"} en etapa
          </span>
          <Avatar className="size-6">
            {deal.agent?.avatar_url ? (
              <AvatarImage src={deal.agent.avatar_url} alt={deal.agent.full_name} />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {initials(deal.agent?.full_name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </button>

      {/* Fallback movil: cambio de etapa sin drag-and-drop. */}
      <div className="mt-2 md:hidden">
        <Select
          value={deal.stage}
          onValueChange={(stage) => onMove(deal.id, stage as DealStage)}
          disabled={disabled}
        >
          <SelectTrigger size="sm" aria-label={`Cambiar etapa de ${deal.contact?.full_name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEAL_STAGES.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
