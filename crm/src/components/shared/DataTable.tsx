"use client";

import { useMemo, type ReactNode } from "react";
import {
  createPaginatedRowModel,
  flexRender,
  rowPaginationFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRowRange } from "@/lib/table-pagination";
import { cn } from "@/lib/utils";

/**
 * Features de TanStack Table v9 usadas por DataTable (estatico, fuera del
 * componente, como recomienda la API).
 */
const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

/**
 * En v9, RowData = Record<string, any> | Array<any>: una `interface` suelta no
 * satisface la constraint, asi que el nucleo de la tabla se instancia sobre este
 * tipo permisivo y la API publica mantiene su TData generico sin restricciones.
 */
type DataTableRow = Record<string, unknown>;

/** Columnas tipadas para DataTable (oculta el parametro de features de TanStack v9). */
export type DataTableColumn<TData> = ColumnDef<
  typeof dataTableFeatures,
  TData & DataTableRow
>;

interface DataTableProps<TData> {
  columns: ReadonlyArray<DataTableColumn<TData>>;
  data: ReadonlyArray<TData>;
  isLoading?: boolean;
  /** Estado vacio personalizado; por defecto usa el EmptyState compartido. */
  emptyState?: ReactNode;
  /** Filas por pagina (por defecto 10). */
  pageSize?: number;
  className?: string;
}

/** Valor crudo para celdas sin template `cell` definido. */
function renderCellFallback(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return value;
  return String(value);
}

/**
 * Tabla generica sobre TanStack Table v9 con paginacion cliente (Task 8).
 * Estados integrados: carga (TableSkeleton) y vacio (EmptyState).
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyState,
  pageSize = 10,
  className,
}: DataTableProps<TData>) {
  // TanStack espera un array mutable; copiamos para respetar ReadonlyArray.
  const mutableData = useMemo(() => [...data], [data]);

  const table = useTable({
    features: dataTableFeatures,
    columns: columns as unknown as ReadonlyArray<
      ColumnDef<typeof dataTableFeatures, DataTableRow>
    >,
    data: mutableData as unknown as DataTableRow[],
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  const rows = table.getRowModel().rows;
  const totalRows = data.length;
  const pageCount = Math.max(1, table.getPageCount());
  const { pageIndex } = table.state.pagination;
  const { from, to } = getRowRange(pageIndex, pageSize, totalRows);

  if (isLoading) {
    return <TableSkeleton rows={Math.min(pageSize, 8)} columns={columns.length} className={className} />;
  }

  if (totalRows === 0) {
    return (
      <div className={className}>
        {emptyState ?? <EmptyState title="Sin resultados" description="Todavía no hay datos para mostrar." />}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  {cell.column.columnDef.cell !== undefined
                    ? flexRender(cell.column.columnDef.cell, cell.getContext())
                    : renderCellFallback(cell.renderValue())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <nav aria-label="Paginación" className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Mostrando {from}–{to} de {totalRows}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft aria-hidden />
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {pageIndex + 1} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </nav>
    </div>
  );
}
