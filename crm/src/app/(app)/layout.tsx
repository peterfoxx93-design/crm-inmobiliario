import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { BrandProvider } from "@/components/theme/BrandProvider";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Agency, Profile } from "@/lib/types";

/**
 * Layout del grupo (app): rutas autenticadas con shell completo.
 * Carga servidor de {profile, agency}:
 * - sin sesion -> /login;
 * - sin profile -> /login (usuario sin fila en profiles);
 * - profile.agency_id null y rol distinto de super_admin -> /login.
 * Un super_admin sin agencia entra igual (branding por defecto).
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

  let agency: Agency | null = null;
  if (profile.agency_id) {
    const { data: agencyRow } = await supabase
      .from("agencies")
      .select("*")
      .eq("id", profile.agency_id)
      .maybeSingle();
    agency = (agencyRow as Agency | null) ?? null;
  }

  return (
    <BrandProvider color={agency?.primary_color ?? null}>
      <AppShell
        user={{
          fullName: profile.full_name,
          email: user.email ?? "",
          avatarUrl: profile.avatar_url,
          role: profile.role,
        }}
        agencyName={agency?.name ?? "CRM Inmobiliario"}
        agencyLogoUrl={agency?.logo_url ?? null}
      >
        {children}
      </AppShell>
    </BrandProvider>
  );
}
