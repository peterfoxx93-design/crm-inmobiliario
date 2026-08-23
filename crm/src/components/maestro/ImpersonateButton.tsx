"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { impersonateStart } from "@/app/actions/agencies";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

interface ImpersonateButtonProps {
  agencyId: string;
  agencyName: string;
}

/**
 * Boton "Suplantar" del panel maestro (Task 17): abre confirmacion y, al
 * aceptar, fija profiles.active_agency_id en servidor con registro de
 * auditoria (impersonation_logs). El shell completo se refresca y aparece el
 * banner ambar; el panel maestro queda bloqueado hasta pulsar "Salir".
 */
export function ImpersonateButton({ agencyId, agencyName }: ImpersonateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleConfirm() {
    const result = await impersonateStart(agencyId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success(`Ahora estás viendo ${agencyName}.`);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => setOpen(true)}
      >
        Suplantar
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Entrar como ${agencyName}?`}
        description="Verás la aplicación con los datos de esta agencia. La sesión quedará registrada en el historial de suplantaciones."
        confirmLabel="Entrar"
        cancelLabel="Cancelar"
        destructive={false}
        onConfirm={handleConfirm}
      />
    </>
  );
}
