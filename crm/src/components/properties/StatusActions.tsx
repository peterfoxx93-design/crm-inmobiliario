"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  markPropertyDealsWon,
  setPropertyStatus,
} from "@/app/actions/properties";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROPERTY_STATUS_META } from "@/lib/constants";
import type { PropertyStatus } from "@/lib/types";

/**
 * Acciones de estado de la ficha (Task 10 Step 3): dropdown con las
 * transiciones objetivo (Activar / Reservar / Vender / Retirar).
 * La transicion es libre entre estados (enmienda controller) y queda
 * auditada en la server action. Al vender se pregunta si marcar ademas
 * los deals asociados como ganados.
 */
export function StatusActions({
  propertyId,
  status,
}: {
  propertyId: string;
  status: PropertyStatus;
}) {
  const router = useRouter();
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function applyStatus(target: PropertyStatus) {
    startTransition(async () => {
      const result = await setPropertyStatus(propertyId, target);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Estado cambiado a ${PROPERTY_STATUS_META[target].label}.`);
      router.refresh();
    });
  }

  function handleSelect(target: PropertyStatus) {
    if (target === status || isPending) return;
    if (target === "vendido") {
      setSellDialogOpen(true); // pregunta: ¿ganar deals tambien?
      return;
    }
    applyStatus(target);
  }

  function sell(withDealsWon: boolean) {
    startTransition(async () => {
      const result = await setPropertyStatus(propertyId, "vendido");
      if (!result.ok) {
        toast.error(result.error);
        setSellDialogOpen(false);
        return;
      }

      let dealsNote = "";
      if (withDealsWon) {
        const dealsResult = await markPropertyDealsWon(propertyId);
        if (dealsResult.ok) {
          const count = dealsResult.data.updated;
          dealsNote =
            count === 1
              ? " 1 deal marcado como ganado."
              : ` ${count} deals marcados como ganados.`;
        } else {
          toast.error(dealsResult.error);
          dealsNote = " (No se pudieron marcar los deals como ganados.)";
        }
      }

      toast.success(`Propiedad marcada como vendida.${dealsNote}`);
      setSellDialogOpen(false);
      router.refresh();
    });
  }

  const targets = (Object.keys(PROPERTY_STATUS_META) as PropertyStatus[]).filter(
    (target) => target !== status && target !== "borrador",
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" disabled={isPending} />}>
          Cambiar estado
          <ChevronDown data-icon="inline-end" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {targets.map((target) => (
            <DropdownMenuItem key={target} onClick={() => handleSelect(target)}>
              Marcar como {PROPERTY_STATUS_META[target].label.toLowerCase()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={sellDialogOpen}
        onOpenChange={(open) => {
          if (!open) setSellDialogOpen(false);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Marcar como vendido</DialogTitle>
            <DialogDescription>
              ¿Quieres marcar también sus deals asociados como ganados y cerrarlos?
              Podrás cambiar el estado sin tocar los deals.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose render={<Button variant="ghost" disabled={isPending} />}>
              Cancelar
            </DialogClose>
            <Button variant="outline" disabled={isPending} onClick={() => sell(false)}>
              Solo cambiar estado
            </Button>
            <Button disabled={isPending} onClick={() => sell(true)}>
              {isPending ? "Procesando…" : "Vender y ganar deals"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
