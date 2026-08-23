import { Bath, BedDouble, ImageOff, MapPin, Ruler } from "lucide-react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { PROPERTY_STATUS_META } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { PropertyWithImages } from "@/lib/queries/properties";
import { cn } from "@/lib/utils";

interface PropertyCardProps {
  property: PropertyWithImages;
  className?: string;
}

/**
 * Tarjeta de propiedad del listado (Task 9): miniatura principal 16:9 con
 * placeholder si no hay fotos, precio EUR, referencia, badges tipo/operacion,
 * StatusBadge y specs (hab/banos/m2) con iconos lucide.
 * Componente de servidor: sin estado ni interaccion.
 */
export function PropertyCard({ property, className }: PropertyCardProps) {
  const mainImage = property.property_images[0];
  const statusMeta = PROPERTY_STATUS_META[property.status];

  return (
    <article
      data-slot="property-card"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {mainImage?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URLs de Storage sin remotePatterns configurado
          <img
            src={mainImage.url}
            alt={property.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="size-6" aria-hidden />
            <span className="text-xs">Sin foto</span>
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Badge>{property.operation === "venta" ? "Venta" : "Alquiler"}</Badge>
          <Badge variant="secondary">{property.property_type}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold tracking-tight">
            {formatCurrency(property.price)}
          </p>
          {statusMeta ? <StatusBadge meta={statusMeta} /> : null}
        </div>

        <h3 className="line-clamp-1 text-sm font-medium">{property.title}</h3>

        <p className="font-mono text-xs text-muted-foreground">{property.reference}</p>

        {property.city ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {property.city}
          </p>
        ) : null}

        <dl className="mt-auto flex items-center gap-3 border-t pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1" title="Dormitorios">
            <BedDouble className="size-3.5" aria-hidden />
            <dd>{property.bedrooms ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-1" title="Baños">
            <Bath className="size-3.5" aria-hidden />
            <dd>{property.bathrooms ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-1" title="Superficie (m²)">
            <Ruler className="size-3.5" aria-hidden />
            <dd>
              {property.surface_m2 != null ? `${property.surface_m2} m²` : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
