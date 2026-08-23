import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgenciesTable } from "@/components/maestro/AgenciesTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { maestroAccessError, type MasterActor } from "@/lib/master-access";
import { listAgenciesWithCounts } from "@/lib/queries/agencies";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Maestro · CRM Inmobiliario",
};

/**
 * Panel maestro multi-agencia (Task 17), solo super_admin.
 * Guard servidor (cierra la deuda del Task 7): sin sesion -> /login;
 * rol distinto de super_admin O suplantacion activa -> /dashboard
 * (mientras se ve otra agencia el panel queda bloqueado para evitar
 * confusion anidada; el banner ambar permite salir).
 */
export default async function MaestroPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, active_agency_id")
    .eq("id", user.id)
    .single();

  if (!profileRow) redirect("/login");

  const guardError = maestroAccessError({
    userId: user.id,
    role: profileRow.role,
    activeAgencyId: profileRow.active_agency_id ?? null,
  } satisfies MasterActor);
  if (guardError) redirect("/dashboard");

  const rows = await listAgenciesWithCounts();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Maestro</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de agencias: branding, activación y suplantación auditada.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState description="Aún no hay agencias. Crea la primera para poder invitar a sus usuarios." />
      ) : (
        <AgenciesTable rows={rows} />
      )}
    </>
  );
}
