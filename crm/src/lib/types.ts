/**
 * Tipos de fila y enums derivados del esquema de Supabase
 * (supabase/migrations/0001_schema.sql, CHECK constraints).
 *
 * Los timestamps se tipan como `string` porque supabase-js devuelve ISO strings,
 * y los `numeric` como `number`.
 */

// --- Enums derivados de CHECK constraints ---

export type PropertyStatus = "borrador" | "activo" | "reservado" | "vendido" | "retirado";
export type PropertyType = "piso" | "casa" | "villa" | "terreno" | "local" | "oficina" | "otro";
export type OperationType = "venta" | "alquiler";
export type ContactStatus = "nuevo" | "en_seguimiento" | "calificado" | "descartado" | "cerrado";
export type ContactType = "comprador" | "inquilino" | "propietario";
export type LeadSource = "web" | "manual" | "referido" | "portal";
export type DealStage = "nuevo_lead" | "calificado" | "visita" | "negociacion" | "cierre";
export type ActivityType = "llamada" | "email" | "whatsapp" | "nota" | "visita" | "tarea" | "sistema";
export type ProfileRole = "super_admin" | "admin" | "agent";

// --- Settings jsonb ---

export interface AgencySettings {
  /** Horas de SLA del primer contacto; null = sin límite. */
  sla_lead_hours?: number | null;
  pipeline_stage_days?: Partial<Record<DealStage, number>>;
  [key: string]: unknown;
}

export interface ContactPreferences {
  property_types?: PropertyType[];
  zones?: string[];
  min_bedrooms?: number;
  max_price?: number;
  [key: string]: unknown;
}

// --- Filas ---

export interface Agency {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  active: boolean;
  settings: AgencySettings;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  agency_id: string | null;
  active_agency_id: string | null; // impersonacion super_admin
  role: ProfileRole;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  agency_id: string;
  reference: string;
  title: string;
  description: string | null;
  property_type: PropertyType;
  operation: OperationType;
  status: PropertyStatus;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  surface_m2: number | null;
  address: string | null;
  city: string | null;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  features: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  position: number;
}

export interface Contact {
  id: string;
  agency_id: string;
  contact_type: ContactType;
  full_name: string;
  email: string | null;
  phone: string;
  notes: string | null;
  source: LeadSource;
  source_detail: string | null;
  status: ContactStatus;
  budget_max: number | null;
  preferences: ContactPreferences;
  consent_rgpd: boolean;
  consent_at: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  agency_id: string;
  contact_id: string;
  property_id: string | null;
  agent_id: string;
  stage: DealStage;
  value: number | null;
  notes: string | null;
  won: boolean | null;
  lost_reason: string | null;
  stage_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  agency_id: string;
  contact_id: string | null;
  deal_id: string | null;
  property_id: string | null;
  type: ActivityType;
  title: string;
  body: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

/** Fila de activity opcionalmente enriquecida con el nombre del autor. */
export type ActivityRow = Activity & { author_name?: string | null };
