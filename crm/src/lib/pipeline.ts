/**
 * Helpers puros del tablero pipeline (Task 13): agrupado por etapa y
 * sumatorios por columna. Sin dependencias de Supabase para poder
 * testearlos como unidades y reutilizarlos en cliente.
 */

import { DEAL_STAGES } from "@/lib/constants";
import type { DealStage } from "@/lib/types";

/** Contacto embebido en el listado (solo lo que pinta la card/drawer). */
export interface DealContactSummary {
  full_name: string;
}

/** Propiedad embebida con su primera imagen (miniatura 16:9). */
export interface DealPropertySummary {
  id: string;
  title: string;
  price: number | null;
  property_images: { url: string; position: number }[];
}

/** Agente propietario del deal. */
export interface DealAgentSummary {
  full_name: string;
  avatar_url: string | null;
}

/** Fila de deals enriquecida con las relaciones que muestra el tablero. */
export interface DealWithRelations {
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
  contact: DealContactSummary | null;
  property: DealPropertySummary | null;
  agent: DealAgentSummary | null;
}

/**
 * Agrupa deals por etapa devolviendo SIEMPRE las 5 columnas
 * (aunque esten vacias), en el orden canonico de DEAL_STAGES.
 */
export function groupDealsByStage(
  deals: readonly DealWithRelations[],
): Record<DealStage, DealWithRelations[]> {
  const grouped = Object.fromEntries(
    DEAL_STAGES.map((stage) => [stage.id, [] as DealWithRelations[]]),
  ) as Record<DealStage, DealWithRelations[]>;

  for (const deal of deals) {
    grouped[deal.stage]?.push(deal);
  }
  return grouped;
}

/** Suma de importes de una columna; valores ausentes cuentan como 0. */
export function sumStageValues(deals: readonly DealWithRelations[]): number {
  return deals.reduce((total, deal) => total + (deal.value ?? 0), 0);
}
