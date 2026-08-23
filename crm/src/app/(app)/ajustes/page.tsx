import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Building2, Globe, Settings, Users } from "lucide-react";

import { BrandingForm } from "@/components/settings/BrandingForm";
import { UsersManager } from "@/components/settings/UsersManager";
import { WebCapturePanel } from "@/components/settings/WebCapturePanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeletons";
import { listAgencyUsers } from "@/lib/admin-users";
import { isAdminRole } from "@/lib/settings-access";
import { parseSettingsTab } from "@/lib/settings-view";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ajustes · CRM Inmobiliario",
};

interface PageProps {
  /** Next 16: searchParams es una Promise; se resuelve y se delega. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Ajustes de la agencia (Task 16): tabs por URL
 * (`?tab=usuarios|branding|captacion`, patron Agenda). Los agents ven una pagina informativa sin edicion; los
 * admin/super_admin gestionan miembros y branding de SU agencia efectiva
 * (`active_agency_id ?? agency_id`). Un super_admin sin impersonar (sin
 * agencia) recibe un aviso claro en lugar de un error.
 */
export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  // Clave estable del boundary Suspense: cualquier cambio de querystring
  // remonta el boundary y muestra el fallback.
  const keyParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) keyParams.set(key, first);
  }
  const tab = parseSettingsTab(params);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // El layout del grupo ya redirige a /login sin sesion o sin perfil.
  if (!user) return null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, role, agency_id, active_agency_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileRow) return null;

  const role = profileRow.role;

  // Agents: vista informativa, sin tabs ni edicion.
  if (!isAdminRole(role)) {
    return (
      <div className="space-y-4">
        <PageHeader />
        <EmptyState
          icon={Building2}
          title="Ajustes solo para administradores"
          description="La gestión de usuarios y el branding de la agencia los realizan los administradores. Si necesitas algún cambio, habla con el administrador de tu agencia."
        />
      </div>
    );
  }

  const effectiveAgencyId = profileRow.active_agency_id ?? profileRow.agency_id;

  // super_admin bootstrap (sin agency_id y sin impersonar): sin crash.
  if (!effectiveAgencyId) {
    return (
      <div className="space-y-4">
        <PageHeader />
        <EmptyState
          icon={AlertTriangle}
          title="No tienes ninguna agencia activa"
          description="Selecciona una agencia desde el panel Maestro para gestionar sus ajustes."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader />
        <nav
          aria-label="Secciones de ajustes"
          className="flex overflow-hidden rounded-md border"
        >
          <Link
            href="/ajustes?tab=branding"
            aria-current={tab === "branding" ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
              tab === "branding"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            <Settings aria-hidden className="size-4" />
            Branding
          </Link>
          <Link
            href="/ajustes?tab=usuarios"
            aria-current={tab === "usuarios" ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
              tab === "usuarios"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            <Users aria-hidden className="size-4" />
            Usuarios
          </Link>
          <Link
            href="/ajustes?tab=captacion"
            aria-current={tab === "captacion" ? "page" : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
              tab === "captacion"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            <Globe aria-hidden className="size-4" />
            Captación web
          </Link>
        </nav>
      </div>

      <Suspense
        key={keyParams.toString()}
        fallback={<TableSkeleton rows={6} columns={5} />}
      >
        {tab === "usuarios" ? (
          <UsuariosContent
            currentUserId={profileRow.id}
          />
        ) : tab === "captacion" ? (
          <CaptacionContent agencyId={effectiveAgencyId} />
        ) : (
          <BrandingContent agencyId={effectiveAgencyId} />
        )}
      </Suspense>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Ajustes</h1>
      <p className="text-sm text-muted-foreground">
        Datos, branding y usuarios de tu agencia.
      </p>
    </div>
  );
}

/** Tab usuarios: perfiles de la agencia + email/estado desde Auth Admin. */
async function UsuariosContent({ currentUserId }: { currentUserId: string }) {
  let users;
  try {
    users = await listAgencyUsers();
  } catch {
    // Fallo de red / BD sin migrar: respuesta amable en lugar de error 500.
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se ha podido cargar la lista de usuarios"
        description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
      />
    );
  }

  return (
    <UsersManager
      users={users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl,
        active: u.active,
      }))}
      currentUserId={currentUserId}
    />
  );
}

/** Tab branding: valores actuales de la agencia para el formulario. */
async function BrandingContent({ agencyId }: { agencyId: string }) {
  const supabase = await createServerSupabase();
  const { data: agency } = await supabase
    .from("agencies")
    .select("name, logo_url, primary_color")
    .eq("id", agencyId)
    .maybeSingle();

  if (!agency) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se ha podido cargar la agencia"
        description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
      />
    );
  }

  return (
    <BrandingForm
      initialName={agency.name}
      initialLogoUrl={agency.logo_url}
      initialColor={agency.primary_color}
    />
  );
}

interface WebFormSettings {
  enabled?: boolean;
  showEmail?: boolean;
  showMessage?: boolean;
  thanksMessage?: string;
}

/**
 * Tab captacion web (Task 18): slug de la agencia efectiva + estado actual
 * de settings.web_form para el toggle y el snippet iframe. Lectura por RLS
 * (la agencia ya viene validada del guard de rol del propio page).
 */
async function CaptacionContent({ agencyId }: { agencyId: string }) {
  const supabase = await createServerSupabase();
  const { data: agency } = await supabase
    .from("agencies")
    .select("slug, settings")
    .eq("id", agencyId)
    .maybeSingle();

  if (!agency?.slug) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se ha podido cargar la agencia"
        description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
      />
    );
  }

  const settings = (agency.settings ?? {}) as Record<string, unknown>;
  const webForm = (settings.web_form ?? {}) as WebFormSettings;

  return (
    <WebCapturePanel
      slug={agency.slug}
      enabled={webForm.enabled ?? false}
      showEmail={webForm.showEmail ?? false}
      showMessage={webForm.showMessage ?? false}
    />
  );
}
