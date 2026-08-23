"use client";

import { useState } from "react";

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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo destructivo para acciones irreversibles (por defecto true). */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

const CONFIRM_ERROR_MESSAGE =
  "No se ha podido completar la acción. Inténtalo de nuevo.";

/**
 * Dialogo de confirmacion para acciones destructivas (Task 8).
 * Sobre Dialog de shadcn/base-ui (no hay AlertDialog en ui/); cierra al confirmar.
 * Si `onConfirm` rechaza, el error se muestra dentro del dialogo y este
 * permanece abierto para reintentar o cancelar.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir/cerrar se limpia el error de un intento anterior (sin efectos).
  function handleOpenChange(nextOpen: boolean) {
    setError(null);
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    try {
      setIsPending(true);
      setError(null);
      await onConfirm();
      onOpenChange(false);
    } catch {
      // No tragamos el fallo: lo hacemos visible al usuario y el dialogo
      // permanece abierto para reintentar.
      setError(CONFIRM_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          {error ? (
            <p role="alert" className="w-full text-sm text-destructive sm:order-first">
              {error}
            </p>
          ) : null}
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            {cancelLabel}
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
