"use client";

/**
 * Tabla de contactos (Task 12 Step 1) sobre DataTable compartida.
 * La fila abre el drawer 360; la columna "última actividad" usa tiempo relativo.
 */

import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { ContactDrawer } from "@/components/contacts/ContactDrawer";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTACT_STATUS_META } from "@/lib/constants";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import type { ContactWithMeta } from "@/lib/queries/contacts";

const CONTACT_TYPE_LABELS: Record<ContactWithMeta["contact_type"], string> = {
  comprador: "Comprador",
  inquilino: "Inquilino",
  propietario: "Propietario",
};

const SOURCE_LABELS = {
  web: "Web",
  manual: "Manual",
  referido: "Referido",
  portal: "Portal",
} as const;

function agentInitials(fullName: string | null | undefined): string {
  return (fullName ?? "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ContactsTable({
  contacts,
  propertyOptions,
}: {
  contacts: readonly ContactWithMeta[];
  propertyOptions: ReadonlyArray<{ id: string; title: string; reference: string }>;
}) {
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const selected = contacts.find((contact) => contact.id === drawerId) ?? null;

  const columns = useMemo<Array<DataTableColumn<ContactWithMeta>>>(
    () => [
      {
        accessorKey: "full_name",
        header: "Contacto",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.original.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {CONTACT_TYPE_LABELS[row.original.contact_type]}
            </p>
          </div>
        ),
      },
      {
        id: "reach",
        header: "Teléfono / Email",
        cell: ({ row }) => (
          <div className="text-xs">
            <p>{row.original.phone}</p>
            {row.original.email ? (
              <p className="text-muted-foreground">{row.original.email}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <StatusBadge meta={CONTACT_STATUS_META[row.original.status]} />
        ),
      },
      {
        accessorKey: "source",
        header: "Origen",
        cell: ({ row }) => SOURCE_LABELS[row.original.source],
      },
      {
        accessorKey: "budget_max",
        header: "Presupuesto",
        cell: ({ getValue }) =>
          typeof getValue() === "number"
            ? formatCurrency(getValue() as number)
            : "—",
      },
      {
        id: "agent",
        header: "Agente",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar className="size-6">
              {row.original.assigned_agent?.avatar_url ? (
                <AvatarImage src={row.original.assigned_agent.avatar_url} alt="" />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {agentInitials(row.original.assigned_agent?.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {row.original.assigned_agent?.full_name ?? "Sin asignar"}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "last_activity_at",
        header: "Última actividad",
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {getValue() ? formatRelativeTime(getValue() as string) : "Nunca"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={`Acciones de ${row.original.full_name}`} />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDrawerId(row.original.id)}>
                Abrir ficha
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={contacts}
        pageSize={12}
        emptyState={
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ningún contacto coincide con los filtros.
          </p>
        }
      />

      {selected && (
        <ContactDrawer
          contact={selected}
          propertyOptions={propertyOptions}
          open={drawerId !== null}
          onOpenChange={(open) => !open && setDrawerId(null)}
        />
      )}
    </>
  );
}
