import "server-only";

import { shiftDayKey, todayKey } from "@/lib/agenda";
import {
  aggregateFunnel,
  buildLeadWindows,
  percentDelta,
  pickSlaBreaches,
  splitTodayOverdue,
  slaHoursOrDefault,
  sumDealValue,
  type FunnelBar,
  type SlaCandidateContact,
  type TodayTask,
} from "@/lib/dashboard";
import { createServerSupabase, getUser } from "@/lib/supabase/server";
import type { AgencySettings, DealStage, ProfileRole } from "@/lib/types";

/**
 * Queries server-only del Dashboard (Task 15). La RLS aísla por agencia;
 * el alcance por rol se aplica en servidor con las columnas de asignación
 * del DDL: contacts.assigned_to, deals.agent_id y activities.created_by.
 * `properties` NO tiene columna de asignación (solo created_by): el conteo
 * de propiedades activas es de agencia para todos los roles (decisión
 * documentada en el informe).
 */

// --- Alcance ---

export type DashboardScope =
  | { kind: "agency" }
  | { kind: "agent"; agentId: string };

export interface DashboardContext {
  scope: DashboardScope;
  slaLeadHours: number;
}

export interface KpiStats {
  /** Leads creados en los ultimos 7 dias. */
  leadsNuevos7d: number;
  /** Leads creados en los 7 dias anteriores (base de comparacion). */
  leadsPrevios7d: number;
  deltaLeadsPct: number | null;
  propiedadesActivas: number;
  /** Actividades tipo 'visita' creadas en el mes en curso. */
  visitasMes: number;
  /** Suma de value de deals ABIERTOS (won IS NULL), igual que el pipeline. */
  valorPipeline: number;
}

export interface TodayData {
  tareasHoy: TodayTask[];
  tareasVencidas: TodayTask[];
  leadsSla: SlaCandidateContact[];
}

/** Techo defensivo por query, igual que el resto de modulos de queries. */
const ROW_CAP = 500;

/**
 * Resuelve usuario + perfil + settings de la agencia UNA vez por request.
 * - sin sesion/perfil -> null (el layout ya redirige; defensa extra).
 * - rol agent -> scope personal; admin/super_admin -> toda la agencia.
 */
export async function resolveDashboardContext(): Promise<DashboardContext | null> {
  const supabase = await createServerSupabase();
  const user = await getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, agency_id, active_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const role = profile.role as ProfileRole;
  const agencyId =
    profile.active_agency_id !== null && profile.active_agency_id !== undefined
      ? profile.active_agency_id
      : (profile.agency_id ?? null);

  // Settings de la agencia activa (SLA leads); sin fila -> default 24.
  let settings: AgencySettings | null = null;
  if (agencyId) {
    const { data: agency } = await supabase
      .from("agencies")
      .select("settings")
      .eq("id", agencyId)
      .maybeSingle();
    settings = (agency?.settings as AgencySettings | null | undefined) ?? null;
  }

  return {
    scope:
      role === "agent" ? { kind: "agent", agentId: user.id } : { kind: "agency" },
    slaLeadHours: slaHoursOrDefault(settings),
  };
}

// --- KPIs ---

export async function getKpiStats(ctx: DashboardContext): Promise<KpiStats> {
  const supabase = await createServerSupabase();
  const agentId = ctx.scope.kind === "agent" ? ctx.scope.agentId : undefined;

  const windows = buildLeadWindows();
  const now = new Date();
  // Mismos bordes de mes que la agenda (claves yyyy-MM-dd filtradas en PG).
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth =
    now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

  async function countContacts(
    fromIso?: string,
    toIso?: string,
  ): Promise<number> {
    let q = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true });
    if (agentId) q = q.eq("assigned_to", agentId);
    if (fromIso) q = q.gte("created_at", fromIso);
    if (toIso) q = q.lt("created_at", toIso);
    const { count, error } = await q;
    if (error) {
      throw new Error(`No se han podido cargar los KPIs: ${error.message}`);
    }
    return count ?? 0;
  }

  const [leadsActuales, leadsPrevios, propiedadesRes, visitasRes, dealsRes] =
    await Promise.all([
      countContacts(windows.currentFrom),
      countContacts(windows.previousFrom, windows.currentFrom),
      // Sin columna de asignacion en properties: conteo de agencia.
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("status", "activo"),
      (() => {
        let q = supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("type", "visita")
          .gte("created_at", monthFrom)
          .lt("created_at", nextMonth);
        if (agentId) q = q.eq("created_by", agentId);
        return q;
      })(),
      (() => {
        let q = supabase.from("deals").select("value").is("won", null).limit(ROW_CAP);
        if (agentId) q = q.eq("agent_id", agentId);
        return q;
      })(),
    ]);

  if (propiedadesRes.error || visitasRes.error || dealsRes.error) {
    const detail =
      propiedadesRes.error?.message ??
      visitasRes.error?.message ??
      dealsRes.error?.message ??
      "";
    throw new Error(`No se han podido cargar los KPIs: ${detail}`);
  }
  if (visitasRes.count === null || visitasRes.count === undefined) {
    throw new Error("No se han podido cargar los KPIs.");
  }

  return {
    leadsNuevos7d: leadsActuales,
    leadsPrevios7d: leadsPrevios,
    deltaLeadsPct: percentDelta(leadsActuales, leadsPrevios),
    propiedadesActivas: propiedadesRes.count ?? 0,
    visitasMes: visitasRes.count ?? 0,
    valorPipeline: sumDealValue(
      (dealsRes.data ?? []) as { value: number | null }[],
    ),
  };
}

// --- Embudo ---

/**
 * Deals ABIERTOS (won IS NULL) contados por etapa; mismos criterios que el
 * kanban del pipeline para que ambos numeros cuadren entre si.
 */
export async function getFunnel(ctx: DashboardContext): Promise<FunnelBar[]> {
  const supabase = await createServerSupabase();

  let query = supabase
    .from("deals")
    .select("stage")
    .is("won", null)
    .limit(ROW_CAP);
  if (ctx.scope.kind === "agent") {
    query = query.eq("agent_id", ctx.scope.agentId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`No se ha podido cargar el embudo: ${error.message}`);
  }

  return aggregateFunnel((data ?? []) as { stage: DealStage }[]);
}

// --- Panel del dia ---

/**
 * Tareas hoy/vencidas + alertas SLA del dia. Las tareas usan la misma
 * convencion que la agenda (clave de dia LOCAL sobre due_date); el piso de
 * 30 dias evita arrastrar un backlog infinito de tareas antiguas.
 */
export async function getTodayData(ctx: DashboardContext): Promise<TodayData> {
  const supabase = await createServerSupabase();

  const today = todayKey();
  const fromDay = shiftDayKey(today, -30);
  const toDay = shiftDayKey(today, 1);

  let tasksQuery = supabase
    .from("activities")
    .select(
      [
        "id",
        "title",
        "due_date",
        "contact:contacts!activities_contact_id_fkey(full_name)",
      ].join(","),
    )
    .eq("type", "tarea")
    .is("completed_at", null)
    .gte("due_date", fromDay)
    .lt("due_date", toDay)
    .order("due_date", { ascending: true })
    .limit(ROW_CAP);

  const now = new Date();
  const cutoffIso = new Date(
    now.getTime() - ctx.slaLeadHours * 60 * 60 * 1000,
  ).toISOString();

  let leadsQuery = supabase
    .from("contacts")
    .select("id, full_name, created_at")
    .eq("status", "nuevo")
    .order("created_at", { ascending: true })
    .limit(ROW_CAP);

  if (ctx.scope.kind === "agent") {
    tasksQuery = tasksQuery.eq("created_by", ctx.scope.agentId);
    leadsQuery = leadsQuery.eq("assigned_to", ctx.scope.agentId);
  }

  const [{ data: taskRows, error: tasksError }, { data: leadRows }] =
    await Promise.all([tasksQuery, leadsQuery]);

  if (tasksError) {
    throw new Error(
      `No se ha podido cargar el panel del dia: ${tasksError.message}`,
    );
  }

  const tasks: TodayTask[] = ((taskRows ??
    []) as unknown as Array<{
    id: string;
    title: string;
    due_date: string | null;
    contact: { full_name: string } | null;
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    due_date: row.due_date,
    contact_name: row.contact?.full_name ?? null,
  }));

  const candidates = (leadRows ?? []) as SlaCandidateContact[];
  const ids = candidates.map((c) => c.id);

  // Anti-join: contactos con CUALQUIER actividad posterior al corte quedan
  // fuera de la alerta aunque el volumen sea alto (query acotada por fecha
  // sobre idx_activities_contact).
  let freshIds: ReadonlySet<string> = new Set<string>();
  if (ids.length > 0) {
    const { data: freshRows } = await supabase
      .from("activities")
      .select("contact_id")
      .in("contact_id", ids)
      .gte("created_at", cutoffIso)
      .limit(2000);
    freshIds = new Set(
      ((freshRows ?? []) as { contact_id: string | null }[])
        .map((r) => r.contact_id)
        .filter((id): id is string => id !== null),
    );
  }

  const { hoy, vencidas } = splitTodayOverdue(tasks, today);

  return {
    tareasHoy: hoy,
    tareasVencidas: vencidas,
    leadsSla: pickSlaBreaches(candidates, freshIds, now, ctx.slaLeadHours),
  };
}
