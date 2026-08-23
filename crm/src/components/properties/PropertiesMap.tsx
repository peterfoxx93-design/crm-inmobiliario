"use client";

/**
 * Mapa de propiedades (Task 11): Leaflet + tiles OpenStreetMap, sin API keys.
 * Se carga SOLO en cliente vía dynamic(ssr:false) desde PropertiesMapPanel,
 * porque Leaflet accede a `window` al importarse.
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { formatCurrency } from "@/lib/format";
import type { PropertyWithImages } from "@/lib/queries/properties";

/** Propiedad ya validada por splitByCoords: coordenadas garantizadas. */
export type MappableProperty = PropertyWithImages & {
  lat: number;
  lng: number;
};

/** Centro y zoom por defecto (España) cuando no hay resultados ubicables. */
const FALLBACK_CENTER: [number, number] = [40.4168, -3.7038];
const FALLBACK_ZOOM = 6;

/** Marcador pin SVG inline: evita depender de las imágenes default de Leaflet. */
function createPinIcon(): L.DivIcon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="#dc2626" stroke="#7f1d1d" stroke-width="1" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>`;
  return L.divIcon({
    html: svg,
    className: "crm-map-pin",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

/** Ajusta el encuadre a los marcadores presentes (si hay alguno). */
function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((p) => L.latLng(p[0], p[1]))),
      { padding: [40, 40] },
    );
  }, [map, points]);
  return null;
}

export interface PropertiesMapProps {
  properties: MappableProperty[];
}

export default function PropertiesMap({ properties }: PropertiesMapProps) {
  const pin = useMemo(() => createPinIcon(), []);
  const points = useMemo(
    () =>
      properties.map(
        (p) => [p.lat, p.lng] as [number, number],
      ),
    [properties],
  );

  return (
    <div className="h-[420px] overflow-hidden rounded-lg border bg-muted md:h-[520px]">
      <MapContainer
        center={FALLBACK_CENTER}
        zoom={FALLBACK_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {properties.map((property) => {
          const image = property.property_images[0]?.url;
          return (
            <Marker
              key={property.id}
              position={[property.lat, property.lng]}
              icon={pin}
            >
              <Popup>
                <div className="w-44 space-y-1">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura en popup Leaflet (mismo criterio que PropertyCard)
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                      Sin foto
                    </div>
                  )}
                  <p className="text-sm font-semibold">
                    {formatCurrency(property.price)}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {property.reference}
                  </p>
                  <Link
                    href={`/propiedades/${property.id}`}
                    className="text-xs font-medium underline underline-offset-2"
                  >
                    Ver ficha
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
