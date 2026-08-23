"use client";

/**
 * Panel de vista mapa (Task 11): envuelve el mapa Leaflet en un
 * dynamic(ssr:false) (obligatorio en App Router) y muestra el contador
 * "N sin ubicación" con accesos directos a las fichas para geolocalizar.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinOff } from "lucide-react";

import { TableSkeleton } from "@/components/shared/Skeletons";
import { splitByCoords } from "@/lib/map-view";
import type { PropertyWithImages } from "@/lib/queries/properties";

const PropertiesMap = dynamic(
  () => import("@/components/properties/PropertiesMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] overflow-hidden rounded-lg border md:h-[520px]">
        <TableSkeleton rows={4} />
      </div>
    ),
  },
);

export interface PropertiesMapPanelProps {
  properties: PropertyWithImages[];
}

export function PropertiesMapPanel({
  properties,
}: PropertiesMapPanelProps) {
  const { withCoords, withoutCoords } = splitByCoords(properties);

  return (
    <div className="space-y-3">
      <PropertiesMap properties={withCoords} />

      {withoutCoords.length > 0 && (
        <div className="rounded-lg border bg-card p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <MapPinOff aria-hidden className="size-4" />
            {withoutCoords.length}{" "}
            {withoutCoords.length === 1
              ? "propiedad sin ubicación"
              : "propiedades sin ubicación"}
          </p>
          <ul className="mt-1 space-y-0.5 pl-6 text-muted-foreground">
            {withoutCoords.map((property) => (
              <li key={property.id}>
                <Link
                  href={`/propiedades/${property.id}`}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {property.title} ({property.reference})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
