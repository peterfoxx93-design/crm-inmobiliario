/**
 * Vocabulario compartido de la UI (100% espanol).
 * Paleta operativa: verde=activo/cerrado, ambar=reservado/pendiente,
 * rojo=alerta SLA, gris=borrador.
 */

import type {
  ActivityType,
  ContactStatus,
  DealStage,
  OperationType,
  PropertyStatus,
  PropertyType,
} from "@/lib/types";

/** Etiqueta + clases Tailwind para badges. */
export interface StatusMeta {
  label: string;
  color: string;
}

export const DEAL_STAGES: { id: DealStage; label: string }[] = [
  { id: "nuevo_lead", label: "Nuevo lead" },
  { id: "calificado", label: "Calificado" },
  { id: "visita", label: "Visita" },
  { id: "negociacion", label: "Negociación" },
  { id: "cierre", label: "Cierre" },
];

export const PROPERTY_STATUS_META: Record<PropertyStatus, StatusMeta> = {
  borrador: { label: "Borrador", color: "bg-gray-100 text-gray-700" },
  activo: { label: "Activo", color: "bg-green-100 text-green-800" },
  reservado: { label: "Reservado", color: "bg-amber-100 text-amber-800" },
  vendido: { label: "Vendido", color: "bg-blue-100 text-blue-800" },
  retirado: { label: "Retirado", color: "bg-red-50 text-red-600" },
};

export const CONTACT_STATUS_META: Record<ContactStatus, StatusMeta> = {
  nuevo: { label: "Nuevo", color: "bg-blue-100 text-blue-800" },
  en_seguimiento: { label: "En seguimiento", color: "bg-amber-100 text-amber-800" },
  calificado: { label: "Calificado", color: "bg-green-100 text-green-800" },
  descartado: { label: "Descartado", color: "bg-gray-100 text-gray-700" },
  cerrado: { label: "Cerrado", color: "bg-green-50 text-green-700" },
};

export const OPERATION_LABELS: Record<OperationType, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
};

export const PROPERTY_TYPES: { id: PropertyType; label: string }[] = [
  { id: "piso", label: "Piso" },
  { id: "casa", label: "Casa" },
  { id: "villa", label: "Villa" },
  { id: "terreno", label: "Terreno" },
  { id: "local", label: "Local" },
  { id: "oficina", label: "Oficina" },
  { id: "otro", label: "Otro" },
];

export const FEATURES_LIST: { id: string; label: string }[] = [
  { id: "piscina", label: "Piscina" },
  { id: "garaje", label: "Garaje" },
  { id: "terraza", label: "Terraza" },
  { id: "ascensor", label: "Ascensor" },
  { id: "aire", label: "Aire acondicionado" },
  { id: "jardin", label: "Jardín" },
  { id: "trastero", label: "Trastero" },
];

/** `icon` es el nombre del icono en lucide-react (se resuelve con un mapa en la UI). */
export const ACTIVITY_TYPE_META: Record<ActivityType, StatusMeta & { icon: string }> = {
  llamada: { label: "Llamada", icon: "Phone", color: "bg-blue-100 text-blue-800" },
  email: { label: "Email", icon: "Mail", color: "bg-purple-100 text-purple-800" },
  whatsapp: { label: "WhatsApp", icon: "MessageCircle", color: "bg-green-100 text-green-800" },
  nota: { label: "Nota", icon: "FileText", color: "bg-gray-100 text-gray-700" },
  visita: { label: "Visita", icon: "MapPin", color: "bg-amber-100 text-amber-800" },
  tarea: { label: "Tarea", icon: "ListTodo", color: "bg-orange-100 text-orange-800" },
  sistema: { label: "Sistema", icon: "Info", color: "bg-gray-50 text-gray-500" },
};
