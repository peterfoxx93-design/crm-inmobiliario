import type { ReactNode } from "react";
import { Hammer, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Icono lucide-react; por defecto Hammer (modulo en construccion). */
  icon?: LucideIcon;
  title?: string;
  description?: string;
  /** Accion principal opcional (normalmente un <Button /> o <Link />). */
  cta?: ReactNode;
  className?: string;
}

/**
 * Estado vacio compartido (Task 7 -> unificado en shared/ en Task 8).
 * Fondo neutro, icono y mensaje claro; `cta` para la accion principal.
 */
export function EmptyState({
  icon: Icon = Hammer,
  title = "Módulo en construcción",
  description = "Esta sección estará disponible próximamente.",
  cta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {cta ? <div className="mt-2">{cta}</div> : null}
    </div>
  );
}
