import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Info,
  ListTodo,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GalleryManager } from "@/components/properties/GalleryManager";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { PropertyTabs } from "@/components/properties/PropertyTabs";
import { StatusActions } from "@/components/properties/StatusActions";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  ACTIVITY_TYPE_META,
  OPERATION_LABELS,
  PROPERTY_STATUS_META,
} from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getPropertyDetail,
  listPropertyActivities,
  type PropertyDetail,
} from "@/lib/queries/properties";
import type { Activity, ActivityType } from "@/lib/types";
import { type PropertyInput } from "@/lib/validators/property";

/**
 * Ficha de propiedad (Task 10): cabecera con referencia/precio/estado y
 * StatusActions; tabs Datos (formulario), Galeria (drag & drop) y Visitas
 * (timeline de activities por property_id; se llena en Task 12).
 */
export const metadata: Metadata = {
  title: "Ficha de propiedad · CRM Inmobiliario",
};

interface PageProps {
  /** Next 16: params es una Promise. */
  params: Promise<{ id: string }>;
}

export default async function PropiedadPage({ params }: PageProps) {
  const { id } = await params;

  let detail: PropertyDetail | null;
  try {
    detail = await getPropertyDetail(id);
  } catch {
    // BD sin migrar / fallo de red: respuesta amable en lugar de error 500.
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se ha podido cargar la propiedad"
        description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
      />
    );
  }

  if (!detail) notFound();

  // La timeline no bloquea la ficha si falla su consulta.
  let activities: Activity[] = [];
  try {
    activities = await listPropertyActivities(detail.id);
  } catch {
    activities = [];
  }

  return (
    <div className="space-y-6">
      <Link
        href="/propiedades"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a propiedades
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{detail.title}</h1>
            <StatusBadge meta={PROPERTY_STATUS_META[detail.status]} />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{detail.reference}</span>
            {" · "}
            {formatCurrency(detail.price)}
            {" · "}
            {OPERATION_LABELS[detail.operation]}
          </p>
        </div>
        <StatusActions propertyId={detail.id} status={detail.status} />
      </header>

      <PropertyTabs
        datos={
          <PropertyForm
            mode="edit"
            propertyId={detail.id}
            defaults={toFormDefaults(detail)}
          />
        }
        galeria={
          // key-reset: tras router.refresh() el Server Component remonta la
          // galeria con la verdad del servidor y su estado optimista se reinicia.
          <GalleryManager
            key={detail.property_images
              .map((image) => `${image.id}:${image.position}`)
              .join("|")}
            propertyId={detail.id}
            images={detail.property_images}
          />
        }
        visitas={<VisitsTimeline activities={activities} />}
      />
    </div>
  );
}

/** Mapea la fila de BD a los valores por defecto del formulario. */
function toFormDefaults(property: PropertyDetail): Partial<PropertyInput> {
  return {
    title: property.title,
    description: property.description ?? "",
    operation: property.operation,
    property_type: property.property_type,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    surface_m2: property.surface_m2,
    address: property.address ?? "",
    city: property.city ?? "",
    zone: property.zone ?? "",
    lat: property.lat,
    lng: property.lng,
    features: property.features,
  };
}

// Iconos lucide por tipo de actividad (nombres en constants.ts).

const ICONS: Record<ActivityType, LucideIcon> = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  nota: FileText,
  visita: MapPin,
  tarea: ListTodo,
  sistema: Info,
};

/**
 * Timeline cronologica de actividades de la propiedad. Hoy registra las
 * auditorias tipo 'sistema' (cambios de estado); Task 12 anadira visitas.
 */
function VisitsTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="Aún no hay visitas registradas"
        description="Las visitas agendadas y los cambios de estado aparecerán aquí en la línea de tiempo."
      />
    );
  }

  return (
    <ol aria-label="Historial de actividad" className="relative space-y-4 border-l pl-5">
      {activities.map((activity) => {
        const Icon = ICONS[activity.type] ?? Info;
        const meta = ACTIVITY_TYPE_META[activity.type];
        return (
          <li key={activity.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-[31px] flex size-6 items-center justify-center rounded-full border bg-background"
            >
              <Icon className="size-3.5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">{activity.title}</p>
            <p className="text-xs text-muted-foreground">
              {meta.label} · {formatDate(activity.created_at)}
            </p>
            {activity.body ? (
              <p className="mt-1 text-sm text-muted-foreground">{activity.body}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
