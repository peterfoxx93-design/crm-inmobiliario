"use client";

/**
 * Tabla de agencias del panel maestro (Task 17): conteos por agencia
 * (usuarios, propiedades, contactos, ofertas) y acciones: editar
 * (AgencyDialog), activar/desactivar (toggleAgencyActive con confirmacion)
 * y suplantar (ImpersonateButton). Tabla en escritorio, tarjetas en movil.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

import { toggleAgencyActive } from "@/app/actions/agencies";
import { AgencyDialog } from "@/components/maestro/AgencyDialog";
import { ImpersonateButton } from "@/components/maestro/ImpersonateButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { AgencyMasterRow } from "@/lib/queries/agencies";

interface AgenciesTableProps {
  rows: AgencyMasterRow[];
}

export function AgenciesTable({ rows }: AgenciesTableProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyMasterRow | null>(null);
  const [togglingTarget, setTogglingTarget] = useState<{
    row: AgencyMasterRow;
    nextActive: boolean;
  } | null>(null);
  const [toggling, setToggling] = useState(false);

  function openEdit(row: AgencyMasterRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleToggle() {
    if (!togglingTarget) return;
    setToggling(true);
    try {
      const result = await toggleAgencyActive(
        togglingTarget.row.agency.id,
        togglingTarget.nextActive,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        togglingTarget.nextActive
          ? "Agencia activada. Sus usuarios ya pueden iniciar sesión."
          : "Agencia desactivada. El acceso queda bloqueado.",
      );
      setTogglingTarget(null);
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Agencia</th>
              <th className="px-3 py-3 text-right font-medium">Usuarios</th>
              <th className="px-3 py-3 text-right font-medium">Prop.</th>
              <th className="px-3 py-3 text-right font-medium">Contactos</th>
              <th className="px-3 py-3 text-right font-medium">Ofertas</th>
              <th className="px-3 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ agency, counts }) => (
              <tr key={agency.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full border"
                      style={{ backgroundColor: agency.primary_color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{agency.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        /{agency.slug}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{counts.users}</td>
                <td className="px-3 py-3 text-right tabular-nums">{counts.properties}</td>
                <td className="px-3 py-3 text-right tabular-nums">{counts.contacts}</td>
                <td className="px-3 py-3 text-right tabular-nums">{counts.deals}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      agency.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {agency.active ? "Activa" : "Desactivada"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => openEdit({ agency, counts })}
                    >
                      <Pencil aria-hidden />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() =>
                        setTogglingTarget({
                          row: { agency, counts },
                          nextActive: !agency.active,
                        })
                      }
                    >
                      <Power aria-hidden />
                      {agency.active ? "Desactivar" : "Activar"}
                    </Button>
                    <ImpersonateButton
                      agencyId={agency.id}
                      agencyName={agency.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movil: tarjetas */}
      <ul className="grid list-none gap-3 md:hidden">
        {rows.map(({ agency, counts }) => (
          <li key={agency.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full border"
                  style={{ backgroundColor: agency.primary_color }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{agency.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    /{agency.slug}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  agency.active
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {agency.active ? "Activa" : "Desactivada"}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ["Usuarios", counts.users],
                  ["Prop.", counts.properties],
                  ["Contactos", counts.contacts],
                  ["Ofertas", counts.deals],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 px-1 py-2">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => openEdit({ agency, counts })}
              >
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() =>
                  setTogglingTarget({
                    row: { agency, counts },
                    nextActive: !agency.active,
                  })
                }
              >
                <Power aria-hidden />
                {agency.active ? "Desactivar" : "Activar"}
              </Button>
              <ImpersonateButton agencyId={agency.id} agencyName={agency.name} />
            </div>
          </li>
        ))}
      </ul>

      <AgencyDialog open={dialogOpen} onOpenChange={setDialogOpen} row={editing} />

      <ConfirmDialog
        open={togglingTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setTogglingTarget(null);
        }}
        title={
          togglingTarget?.nextActive
            ? `¿Activar ${togglingTarget.row.agency.name}?`
            : `¿Desactivar ${togglingTarget?.row.agency.name ?? ""}?`
        }
        description={
          togglingTarget?.nextActive
            ? "Los usuarios volverán a poder iniciar sesión."
            : "Los usuarios no podrán iniciar sesión hasta que se reactive."
        }
        confirmLabel={togglingTarget?.nextActive ? "Activar" : "Desactivar"}
        destructive={!togglingTarget?.nextActive}
        onConfirm={handleToggle}
      />

      {/* Spinner de la accion de toggle (feedback fuera del dialogo) */}
      {toggling && (
        <div role="status" className="sr-only">
          <Loader2 className="animate-spin" aria-hidden />
          Aplicando cambio…
        </div>
      )}
    </>
  );
}
