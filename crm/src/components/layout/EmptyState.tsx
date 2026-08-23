import { Hammer } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

/**
 * Estado vacio compartido para los placeholders de modulos (Task 7).
 * Fondo neutro y mensaje claro mientras los modulos estan en construccion.
 */
export function EmptyState({
  title = "Módulo en construcción",
  description = "Esta sección estará disponible próximamente.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Hammer className="size-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
