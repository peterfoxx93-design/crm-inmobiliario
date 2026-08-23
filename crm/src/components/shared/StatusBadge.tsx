import { Badge } from "@/components/ui/badge";
import type { StatusMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  /** Meta de estado (PROPERTY_STATUS_META, CONTACT_STATUS_META, DEAL_STAGE_META...). */
  meta: StatusMeta;
  className?: string;
}

/**
 * Badge de estado con la paleta operativa definida en los maps de constants:
 * verde=activo/cerrado, ambar=reservado/pendiente, rojo=alerta SLA, gris=borrador.
 * Las clases de `meta.color` ganan sobre las del variant (tailwind-merge).
 */
export function StatusBadge({ meta, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("border-transparent", meta.color, className)}>
      {meta.label}
    </Badge>
  );
}
