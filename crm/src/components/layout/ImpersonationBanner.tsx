"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { impersonateStop } from "@/app/actions/agencies";
import { Button } from "@/components/ui/button";

/**
 * Banner fijo ambar de impersonacion (Task 17): «Estas viendo {agencia} ·
 * Salir». Se muestra a nivel de shell mientras profiles.active_agency_id no
 * es null; "Salir" limpia el contexto y cierra el registro de auditoria en
 * servidor (impersonateStop) antes de refrescar el shell.
 */
export function ImpersonationBanner({ agencyName }: { agencyName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleExit() {
    setPending(true);
    try {
      const result = await impersonateStop();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Has vuelto a tu sesión.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="status"
      className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-3 text-sm text-amber-950 md:px-6"
    >
      <p className="flex min-w-0 items-center gap-2">
        <Eye className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          Estás viendo <strong>{agencyName}</strong>
        </span>
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 border-amber-400 bg-transparent text-amber-950 hover:bg-amber-200 hover:text-amber-950"
        disabled={pending}
        onClick={() => void handleExit()}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : null}
        Salir
      </Button>
    </div>
  );
}
