"use client";

import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { CardSkeleton, KanbanSkeleton } from "@/components/shared/Skeletons";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  OPERATION_LABELS,
  PROPERTY_STATUS_META,
  PROPERTY_TYPES,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { OperationType, PropertyStatus, PropertyType } from "@/lib/types";

/**
 * Demo temporal de los componentes compartidos (Task 8).
 * TODO(Task 9): sustituir por el listado real de propiedades (Supabase + RLS).
 */

interface PropiedadDemo {
  id: string;
  referencia: string;
  titulo: string;
  tipo: PropertyType;
  operacion: OperationType;
  precio: number;
  estado: PropertyStatus;
}

const PROPIEDADES_DEMO: PropiedadDemo[] = [
  { id: "p01", referencia: "P-0001", titulo: "Piso luminoso en Centro", tipo: "piso", operacion: "venta", precio: 185000, estado: "activo" },
  { id: "p02", referencia: "P-0002", titulo: "Ático con terraza en Playa", tipo: "piso", operacion: "venta", precio: 320000, estado: "reservado" },
  { id: "p03", referencia: "P-0003", titulo: "Villa independiente con piscina", tipo: "villa", operacion: "venta", precio: 545000, estado: "activo" },
  { id: "p04", referencia: "P-0004", titulo: "Casa adosada reformada", tipo: "casa", operacion: "venta", precio: 240000, estado: "borrador" },
  { id: "p05", referencia: "P-0005", titulo: "Piso para entrar a vivir", tipo: "piso", operacion: "alquiler", precio: 950, estado: "activo" },
  { id: "p06", referencia: "P-0006", titulo: "Estudio junto a la universidad", tipo: "piso", operacion: "alquiler", precio: 650, estado: "activo" },
  { id: "p07", referencia: "P-0007", titulo: "Local comercial en avenida", tipo: "local", operacion: "alquiler", precio: 1800, estado: "retirado" },
  { id: "p08", referencia: "P-0008", titulo: "Oficina diáfana zona negocios", tipo: "oficina", operacion: "alquiler", precio: 1200, estado: "vendido" },
  { id: "p09", referencia: "P-0009", titulo: "Terreno urbanizable con vistas", tipo: "terreno", operacion: "venta", precio: 98000, estado: "activo" },
  { id: "p10", referencia: "P-0010", titulo: "Dúplex con garaje incluido", tipo: "piso", operacion: "venta", precio: 210000, estado: "reservado" },
  { id: "p11", referencia: "P-0011", titulo: "Chalet con jardín y trastero", tipo: "casa", operacion: "venta", precio: 385000, estado: "activo" },
  { id: "p12", referencia: "P-0012", titulo: "Piso de obra nueva en estreno", tipo: "piso", operacion: "venta", precio: 265000, estado: "borrador" },
];

const TIPO_LABELS = new Map(PROPERTY_TYPES.map((t) => [t.id, t.label]));

export function PropiedadesDemo() {
  const [propiedades, setPropiedades] = useState<PropiedadDemo[]>(PROPIEDADES_DEMO);
  const [isLoading, setIsLoading] = useState(true);
  const [pendienteEliminar, setPendienteEliminar] = useState<PropiedadDemo | null>(null);

  // Carga simulada para demostrar los skeleton screens.
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const columns = useMemo<Array<DataTableColumn<PropiedadDemo>>>(
    () => [
      { accessorKey: "referencia", header: "Ref." },
      { accessorKey: "titulo", header: "Título" },
      {
        accessorKey: "tipo",
        header: "Tipo",
        cell: (info) => TIPO_LABELS.get(info.row.original.tipo) ?? info.getValue(),
      },
      {
        accessorKey: "operacion",
        header: "Operación",
        cell: (info) => OPERATION_LABELS[info.row.original.operacion],
      },
      {
        accessorKey: "precio",
        header: "Precio",
        cell: (info) => formatCurrency(info.row.original.precio),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: (info) => <StatusBadge meta={PROPERTY_STATUS_META[info.row.original.estado]} />,
      },
      {
        id: "acciones",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setPendienteEliminar(row.original)}
          >
            Eliminar
          </Button>
        ),
      },
    ],
    [],
  );

  function confirmarEliminacion() {
    if (!pendienteEliminar) return;
    setPropiedades((prev) => prev.filter((p) => p.id !== pendienteEliminar.id));
    setPendienteEliminar(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsLoading(true)}>
          Simular carga
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setPropiedades((prev) => (prev.length === 0 ? PROPIEDADES_DEMO : []))
          }
        >
          {propiedades.length === 0 ? "Restaurar datos" : "Vaciar datos"}
        </Button>
      </div>

      {isLoading ? (
        <DataTable columns={columns} data={[]} isLoading />
      ) : (
        <DataTable
          columns={columns}
          data={propiedades}
          pageSize={10}
          emptyState={
            <EmptyState
              title="Sin propiedades"
              description="Aún no hay inmuebles registrados en esta agencia."
            />
          }
        />
      )}

      {/* Demo temporal del resto de esqueletos compartidos.
          TODO(Task 9): eliminar esta seccion al conectar datos reales. */}
      <section aria-label="Demostración de esqueletos" className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Esqueletos disponibles (demo temporal)
        </h2>
        <div className="grid max-w-md grid-cols-2 items-start gap-4 sm:max-w-lg">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <KanbanSkeleton columns={4} cardsPerColumn={3} />
      </section>

      <ConfirmDialog
        open={pendienteEliminar !== null}
        onOpenChange={(open) => {
          if (!open) setPendienteEliminar(null);
        }}
        title="¿Eliminar propiedad?"
        description={
          pendienteEliminar
            ? `Se eliminará «${pendienteEliminar.titulo}» (${pendienteEliminar.referencia}). Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        onConfirm={confirmarEliminacion}
      />
    </div>
  );
}
