import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeletons compartidos (Task 8): tarjeta, tabla y kanban.
 * Todos exponen role="status" para lectores de pantalla mientras se cargan datos.
 */

interface CardSkeletonProps {
  className?: string;
}

/** Tarjeta con miniatura 16:9 y lineas de texto (listados de propiedades). */
export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      data-slot="card-skeleton"
      className={cn("space-y-3 rounded-xl border bg-card p-4", className)}
    >
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

interface CardGridSkeletonProps {
  /** Numero de tarjetas simuladas (por defecto 6). */
  count?: number;
  className?: string;
}

/** Grid responsive de tarjetas (listado de propiedades, 1/2/3 columnas). */
export function CardGridSkeleton({ count = 6, className }: CardGridSkeletonProps) {
  const safeCount = Math.max(1, count);

  return (
    <div
      data-slot="card-grid-skeleton"
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}
    >
      {Array.from({ length: safeCount }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

/** Filas y columnas de barras simulando una DataTable en carga. */
export function TableSkeleton({ rows = 5, columns = 5, className }: TableSkeletonProps) {
  const safeRows = Math.max(1, rows);
  const safeColumns = Math.max(1, columns);

  return (
    <div
      role="status"
      aria-busy="true"
      data-slot="table-skeleton"
      className={cn("rounded-xl border bg-card p-4", className)}
    >
      <div
        className="grid gap-x-4 gap-y-3"
        style={{ gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: safeColumns }, (_, i) => (
          <Skeleton key={`header-${i}`} className="h-3 w-2/3" />
        ))}
        {Array.from({ length: safeRows * safeColumns }, (_, i) => (
          <Skeleton key={`cell-${i}`} className="h-4 w-full" />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

interface KanbanSkeletonProps {
  columns?: number;
  cardsPerColumn?: number;
  className?: string;
}

/** Columnas de pipeline con tarjetas simuladas (vista Kanban). */
export function KanbanSkeleton({
  columns = 5,
  cardsPerColumn = 3,
  className,
}: KanbanSkeletonProps) {
  const safeColumns = Math.max(1, columns);
  const safeCards = Math.max(1, cardsPerColumn);

  return (
    <div
      role="status"
      aria-busy="true"
      data-slot="kanban-skeleton"
      className={cn("flex gap-4 overflow-hidden", className)}
    >
      {Array.from({ length: safeColumns }, (_, col) => (
        <div key={`col-${col}`} className="w-64 shrink-0 space-y-3">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: safeCards }, (_, card) => (
            <div key={`card-${col}-${card}`} className="space-y-2 rounded-xl border bg-card p-3">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
