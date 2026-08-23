import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { PublicLeadForm } from "@/components/form/PublicLeadForm";
import { createAdminSupabase } from "@/lib/admin-users";

/**
 * Formulario publico de captacion embebible (Task 18): /form/[slug].
 *
 * Fuera del grupo (app): SIN shell ni guard de sesion (el middleware ya
 * excluye `form/`). La pagina resuelve slug -> agencia con service_role en
 * servidor porque el rol anon no puede leer `agencies` por RLS; solo se
 * exponen los datos ya publicos de marca (nombre, logo, color) y la
 * configuracion del formulario. Slug invalido, agencia inexistente/inactiva
 * o captacion desactivada -> pagina neutra en espanol (sin filtrar si el
 * slug existe o no).
 */

export const metadata: Metadata = {
  title: "Formulario de contacto",
  robots: { index: false },
};

interface PageProps {
  /** Next 16: params es una Promise. */
  params: Promise<{ slug: string }>;
}

/** Mismo formato de slug que lib/slug.ts / validators/agency.ts. */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

interface WebFormSettings {
  enabled?: boolean;
  showEmail?: boolean;
  showMessage?: boolean;
  thanksMessage?: string;
}

/** Pagina neutra: mismo aspecto para slug falso, agencia apagada o form off. */
function UnavailableView() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
          <Building2 aria-hidden className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Formulario no disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este formulario de contacto no está disponible ahora mismo. Si crees
          que es un error, contacta con la agencia por otra vía.
        </p>
      </div>
    </main>
  );
}

export default async function PublicLeadPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return <UnavailableView />;
  }

  const admin = createAdminSupabase();
  const { data: agency } = await admin
    .from("agencies")
    .select("name, logo_url, primary_color, settings")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  const settings = (agency?.settings ?? {}) as Record<string, unknown>;
  const webForm = (settings.web_form ?? {}) as WebFormSettings;

  if (!agency || !webForm.enabled) {
    return <UnavailableView />;
  }

  return (
    <main className="flex min-h-svh items-start justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-5">
        {/* Marca publica: logo opcional, nombre y color de la agencia */}
        <div className="flex flex-col items-center gap-2 text-center">
          {agency.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL https validada al guardarla; dominio externo al optimizador
            <img
              src={agency.logo_url}
              alt={`Logo de ${agency.name}`}
              className="h-14 w-auto max-w-[180px] object-contain"
            />
          ) : null}
          <h1 className="text-lg font-semibold tracking-tight">
            Contacta con {agency.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Déjanos tus datos y te respondemos lo antes posible.
          </p>
        </div>

        <PublicLeadForm
          slug={slug}
          showEmail={webForm.showEmail ?? false}
          showMessage={webForm.showMessage ?? false}
          thanksMessage={webForm.thanksMessage}
          primaryColor={agency.primary_color}
        />
      </div>
    </main>
  );
}
