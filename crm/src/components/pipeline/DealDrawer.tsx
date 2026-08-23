"use client";

/**
 * Drawer del deal (Task 13 Step 3): edicion de notas/importe, historial de
 * actividades del deal y cierre ganado/perdido (perdida con motivo
 * obligatorio). Tras ganar un deal con propiedad asociada se sugiere
 * marcarla vendida via la action existente setPropertyStatus.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";

import { closeDeal, updateDeal } from "@/app/actions/deals";
import { setPropertyStatus } from "@/app/actions/properties";
import { ActivityFeed } from "@/components/shared/ActivityFeed";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { DealWithRelations } from "@/lib/pipeline";
import { createClient } from "@/lib/supabase/client";
import type { Activity } from "@/lib/types";

export interface DealDrawerProps {
  /** Deal seleccionado; null = cerrado. */
  deal: DealWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FetchedActivities {
  key: string;
  activities: Activity[];
  error: string | null;
}

export function DealDrawer({ deal, open, onOpenChange }: DealDrawerProps) {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const reloadActivities = useCallback(() => setReloadKey((key) => key + 1), []);

  // Patron fetchKey de ContactDrawer: estado derivado, sin efectos de escritura.
  const dealId = deal?.id ?? "";
  const fetchKey = `${dealId}:${open ? 1 : 0}:${reloadKey}`;
  const [fetched, setFetched] = useState<FetchedActivities>({
    key: "",
    activities: [],
    error: null,
  });
  const isLoadingActivities = deal !== null && fetched.key !== fetchKey;

  useEffect(() => {
    if (!open || !isLoadingActivities || !dealId) return;
    let cancelled = false;

    // Cliente browser de @supabase/ssr: sesion compartida con el server.
    createClient()
      .from("activities")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!cancelled) {
          setFetched({
            key: fetchKey,
            activities: (data ?? []) as Activity[],
            error: error ? "No se ha podido cargar el historial." : null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dealId, open, isLoadingActivities, fetchKey]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {deal ? (
          <>
            <SheetHeader>
              <SheetTitle>{deal.contact?.full_name ?? "Oferta"}</SheetTitle>
              <SheetDescription>
                {deal.property?.title
                  ? `Oferta sobre «${deal.property.title}».`
                  : "Detalle de la oferta en el pipeline."}
              </SheetDescription>
            </SheetHeader>

            {/* Remonte por deal: estado inicial limpio sin efectos de sync. */}
            <DealDrawerBody
              key={deal.id}
              deal={deal}
              onClose={() => onOpenChange(false)}
              onClosed={() => {
                onOpenChange(false);
                router.refresh();
              }}
              onActivityChanged={reloadActivities}
            >
              <section aria-label="Historial de actividades" className="space-y-3">
                {isLoadingActivities ? (
                  <p className="text-sm text-muted-foreground">Cargando historial…</p>
                ) : fetched.error ? (
                  <div role="alert" className="text-sm text-red-600">
                    {fetched.error}
                  </div>
                ) : (
                  <ActivityFeed activities={fetched.activities} />
                )}
              </section>
            </DealDrawerBody>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle>Oferta</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface DealDrawerBodyProps {
  deal: DealWithRelations;
  children: React.ReactNode;
  onClose: () => void;
  /** Cierra el drawer Y refresca los datos de servidor. */
  onClosed: () => void;
  onActivityChanged: () => void;
}

/** Cuerpo editable: notas/valor, cierre ganado-perdido y aviso de propiedad vendida. */
function DealDrawerBody({
  deal,
  children,
  onClose,
  onClosed,
  onActivityChanged,
}: DealDrawerBodyProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [value, setValue] = useState(deal.value !== null ? String(deal.value) : "");
  const [isSaving, setIsSaving] = useState(false);
  const [wonDialogOpen, setWonDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [isMarkingSold, setIsMarkingSold] = useState(false);
  // El aviso desaparece tras marcar la propiedad como vendida con exito.
  const [propertySold, setPropertySold] = useState(false);
  // Cierre ganado hecho desde este drawer: mantiene abierto para ofrecer
  // marcar la propiedad como vendida (el board se refresca por detras).
  const [wonHere, setWonHere] = useState(false);

  const isWon = wonHere || deal.won === true;
  const showSoldNotice = isWon && deal.property !== null && !propertySold;

  async function handleSave() {
    setIsSaving(true);
    try {
      // Importe vacio = limpiar el valor (columna nullable del DDL).
      const result = await updateDeal(deal.id, { notes, value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Cambios guardados.");
      onActivityChanged();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleWon() {
    const result = await closeDeal(deal.id, true);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error); // mantiene el ConfirmDialog abierto
    }
    setWonHere(true);
    toast.success("Oferta marcada como ganada.");
    onActivityChanged();
    router.refresh();
  }

  async function handleLost() {
    const reason = lostReason.trim();
    if (!reason) {
      toast.error("Indica el motivo de la pérdida.");
      throw new Error("Motivo obligatorio.");
    }
    const result = await closeDeal(deal.id, false, reason);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success("Oferta marcada como perdida.");
    onClosed();
  }

  async function handleMarkSold() {
    if (!deal.property) return;
    setIsMarkingSold(true);
    try {
      const result = await setPropertyStatus(deal.property.id, "vendido");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPropertySold(true);
      toast.success("Propiedad marcada como vendida.");
      onActivityChanged();
    } finally {
      setIsMarkingSold(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-8">
      {/* Datos editables */}
      <section aria-label="Datos de la oferta" className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor={`deal-value-${deal.id}`}>Importe (EUR)</Label>
          <Input
            id={`deal-value-${deal.id}`}
            inputMode="decimal"
            placeholder="Ej. 250000"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`deal-notes-${deal.id}`}>Notas</Label>
          <Textarea
            id={`deal-notes-${deal.id}`}
            rows={4}
            placeholder="Notas internas de la oferta…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
      </section>

      {/* Aviso post-cierre ganado: sugerencia de vender la propiedad */}
      {showSoldNotice ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            ¿Marcar también «{deal.property?.title}» como vendida?
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleMarkSold()}
            disabled={isMarkingSold}
          >
            {isMarkingSold ? "Marcando…" : "Marcar propiedad como vendida"}
          </Button>
        </div>
      ) : null}

      {/* Cierre */}
      <section aria-label="Cerrar oferta" className="space-y-2">
        <h3 className="text-sm font-semibold">Cerrar oferta</h3>
        <p className="text-xs text-muted-foreground">
          La oferta desaparecerá del pipeline al cerrarse.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={isWon}
            onClick={() => setWonDialogOpen(true)}
          >
            {isWon ? "Ganada" : "Marcar ganado"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isWon}
            onClick={() => setLostDialogOpen(true)}
          >
            Marcar perdido
          </Button>
        </div>
      </section>

      {children}

      <div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      {/* Ganado: confirmacion simple */}
      <ConfirmDialog
        open={wonDialogOpen}
        onOpenChange={setWonDialogOpen}
        title="¿Marcar la oferta como ganada?"
        description="Se cerrará y dejará de verse en el pipeline."
        confirmLabel="Sí, marcar ganada"
        cancelLabel="Cancelar"
        destructive={false}
        onConfirm={handleWon}
      />

      {/* Perdido: motivo obligatorio antes de confirmar */}
      <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>¿Marcar la oferta como perdida?</DialogTitle>
            <DialogDescription>
              Indica el motivo: quedará registrado en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`deal-lost-reason-${deal.id}`}>Motivo (obligatorio)</Label>
            <Input
              id={`deal-lost-reason-${deal.id}`}
              placeholder="Ej. Compró otra propiedad"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose render={<Button variant="outline" disabled={isClosing} />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isClosing || lostReason.trim() === ""}
              onClick={() => {
                setIsClosing(true);
                handleLost().finally(() => setIsClosing(false));
              }}
            >
              {isClosing ? "Procesando…" : "Confirmar pérdida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
