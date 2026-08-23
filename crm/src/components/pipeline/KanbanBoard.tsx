"use client";

/**
 * Tablero Kanban del pipeline (Task 13 Step 1): 5 columnas con scroll
 * horizontal, drag & drop cross-column con @dnd-kit/sortable (patron
 * GalleryManager: update optimista + rollback con toast en error) y
 * cabeceras con contador + suma de importes compacta.
 *
 * La card es a la vez sortable y boton de apertura del drawer: un click
 * plano nunca activa el drag (activationConstraint.distance=5) y tras un
 * drag real el click residual se descarta con un guard temporal.
 */

import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { moveDeal } from "@/app/actions/deals";
import { DealDrawer } from "@/components/pipeline/DealDrawer";
import { KanbanCard } from "@/components/pipeline/KanbanCard";
import { DEAL_STAGES } from "@/lib/constants";
import { formatCompactEur } from "@/lib/format";
import { groupDealsByStage, sumStageValues, type DealWithRelations } from "@/lib/pipeline";
import type { DealStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface KanbanBoardProps {
  deals: DealWithRelations[];
  /** Umbrales SLA por etapa (agencies.settings.pipeline_stage_days). */
  stageDays: Partial<Record<DealStage, number>>;
}

/** Ventana (ms) tras la que un click se ignora si acaba de soltarse un drag. */
const CLICK_GUARD_MS = 250;

export function KanbanBoard({ deals, stageDays }: KanbanBoardProps) {
  const router = useRouter();

  // Estado local optimista; el rollback restaura el snapshot previo al cambio.
  const [items, setItems] = useState<DealWithRelations[]>(deals);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragGuardUntil = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function openDeal(dealId: string) {
    if (Date.now() < dragGuardUntil.current) return; // click residual de un drag
    setSelectedId(dealId);
  }

  async function persistMove(dealId: string, nextStage: DealStage) {
    const snapshot = items;
    // Optimista: nueva etapa + reinicio del contador SLA.
    setItems((prev) =>
      prev.map((deal) =>
        deal.id === dealId
          ? { ...deal, stage: nextStage, stage_updated_at: new Date().toISOString() }
          : deal,
      ),
    );

    const result = await moveDeal(dealId, nextStage);
    if (!result.ok) {
      toast.error(result.error);
      setItems(snapshot); // rollback al estado real previo
      return;
    }
    toast.success("Oferta movida.");
    startTransition(() => router.refresh());
  }

  function requestMove(dealId: string, nextStage: DealStage) {
    void persistMove(dealId, nextStage);
  }

  function handleDragEnd(event: DragEndEvent) {
    // El click sintetizado tras soltar llega justo despues: lo acallamos.
    dragGuardUntil.current = Date.now() + CLICK_GUARD_MS;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const deal = items.find((item) => item.id === active.id);
    if (!deal) return;

    // El destino puede ser una columna (id = etapa) o otra card (id = deal).
    const targetStage =
      DEAL_STAGES.find((stage) => stage.id === over?.id)?.id ??
      items.find((item) => item.id === over?.id)?.stage;
    if (!targetStage || targetStage === deal.stage) return;

    void persistMove(deal.id, targetStage);
  }

  const grouped = groupDealsByStage(items);
  const selectedDeal = selectedId ? (items.find((d) => d.id === selectedId) ?? null) : null;

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-w-max gap-4 pb-4">
            {DEAL_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage.id}
                label={stage.label}
                deals={grouped[stage.id]}
                slaDays={stageDays[stage.id]}
                disabled={isPending}
                onOpen={openDeal}
                onMove={requestMove}
              />
            ))}
          </div>
        </DndContext>
      </div>

      <DealDrawer
        deal={selectedDeal}
        open={selectedDeal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            router.refresh(); // refleja cambios del drawer al volver al board
          }
        }}
      />
    </>
  );
}

interface KanbanColumnProps {
  stage: DealStage;
  label: string;
  deals: DealWithRelations[];
  slaDays?: number;
  disabled?: boolean;
  onOpen: (dealId: string) => void;
  onMove: (dealId: string, nextStage: DealStage) => void;
}

/** Columna droppable con cabecera (etiqueta, count y suma compacta). */
function KanbanColumn({
  stage,
  label,
  deals,
  slaDays,
  disabled,
  onOpen,
  onMove,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section aria-label={`Etapa ${label}`} className="w-72 shrink-0 space-y-2">
      <header className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground">
          {deals.length} · {formatCompactEur(sumStageValues(deals))}
        </span>
      </header>

      {/* Las cards son los propios sortables (id = deal id): el destino de un
          drop puede ser esta columna o cualquiera de sus cards. */}
      <SortableContext items={deals.map((deal) => deal.id)}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[120px] flex-col gap-2 rounded-lg p-1 transition-colors",
            isOver && "bg-primary/5 ring-1 ring-primary/30",
          )}
        >
          {deals.map((deal) => (
            <KanbanCard
              key={deal.id}
              deal={deal}
              slaDays={slaDays}
              disabled={disabled}
              onOpen={onOpen}
              onMove={onMove}
            />
          ))}
          {deals.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              Sin ofertas
            </p>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}
