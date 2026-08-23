import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { BrandProvider } from "@/components/theme/BrandProvider";
import { Toaster } from "@/components/ui/sonner";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Agency, Profile } from "@/lib/types";

/**
 * Layout del grupo (app): rutas autenticadas con shell completo.
 * Carga servidor de {profile, agency}:
 * - sin sesion -> /login;
 * - sin profile -> /login (usuario sin fila en profiles);
 * - profile.agency_id null y rol distinto de super_admin -> /login.
 * Un super_admin sin agencia entra igual (branding por defecto).
 *
 * Task 17:
 * - La agencia EFECTIVA es coalesce(active_agency_id, agency_id): mientras un
 *   super_admin suplanta, todo el shell (branding, sidebar) muestra la
 *   agencia destino, igual que resuelve get_my_agency_id() en SQL.
 * - Gate servidor anti-agencia-desactivada: si la agencia PROPIA del usuario
 *   esta inactiva se cierra la sesion y se redirige a /login?error=agencia
 *   (defensa en profundidad: get_public_branding ya oculta el slug en el
 *   paso 1 del login, pero una sesion viva o un signInWithPassword directo
 *   no pasaban por ahi).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileRow) redirect("/login");
  const profile = profileRow as Profile;

  if (!profile.agency_id && profile.role !== "super_admin") {
    redirect("/login");
  }

  // Agencia efectiva (impersonacion incluida), misma semantica que SQL.
  const effectiveAgencyId = profile.active_agency_id ?? profile.agency_id;

  let agency: Agency | null = null;
  if (effectiveAgencyId) {
    const { data: agencyRow } = await supabase
      .from("agencies")
      .select("*")
      .eq("id", effectiveAgencyId)
      .maybeSingle();
    agency = (agencyRow as Agency | null) ?? null;
  }

  // Login bloqueado para agencias desactivadas (Task 17 Step 2). Los
  // super_admin nunca se bloquean: necesitan poder reactivar o auditar.
  if (
    profile.role !== "super_admin" &&
    profile.agency_id &&
    profile.agency_id === effectiveAgencyId &&
    agency &&
    !agency.active
  ) {
    await supabase.auth.signOut();
    redirect("/login?error=agencia");
  }

  const impersonating =
    profile.role === "super_admin" && profile.active_agency_id !== null;

  return (
    <BrandProvider color={agency?.primary_color ?? null}>
      {/* Montaje global de sonner: sin esto ningun toast() de la app se ve. */}
      <Toaster richColors position="top-right" />
      <AppShell
        user={{
          fullName: profile.full_name,
          email: user.email ?? "",
          avatarUrl: profile.avatar_url,
          role: profile.role,
        }}
        agencyName={agency?.name ?? "CRM Inmobiliario"}
        agencyLogoUrl={agency?.logo_url ?? null}
        impersonation={
          impersonating ? { agencyName: agency?.name ?? "agencia" } : null
        }
      >
        {children}
      </AppShell>
    </BrandProvider>
  );
}
