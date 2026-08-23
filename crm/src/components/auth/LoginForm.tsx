"use client";

import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENCY_SLUG_STORAGE_KEY, sanitizeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

/** Fila que devuelve la función SQL `get_public_branding` (solo agencias activas). */
interface PublicBranding {
  name: string;
  logo_url: string | null;
  primary_color: string;
}

interface LoginFormProps {
  /** Slug de ?agencia= (ya normalizado en el servidor) o null si falta. */
  initialSlug: string | null;
  /** Destino post-login ya resuelto en el servidor (O1; por defecto /dashboard). */
  nextPath: string;
  /** true cuando el callback devolvió a /login?error=auth. */
  authError?: boolean;
  /** true cuando el layout devolvió a /login?error=agencia (agencia desactivada, Task 17). */
  agencyError?: boolean;
}

type Step = "cargando" | "slug" | "form";

/** Lectura hidratación-safe del slug recordrado en localStorage. */
const subscribeNoop = () => () => {};
function getStoredSlug(): string | null {
  return window.localStorage.getItem(AGENCY_SLUG_STORAGE_KEY);
}
function getServerSlug(): string | null {
  return null;
}

const AUTH_ERROR_BANNER = "El enlace de acceso no es válido o ha caducado.";
const AGENCY_UNAVAILABLE =
  "Esta agencia no está disponible o está desactivada. Contacta con tu administradora.";

/** Traduce errores de Supabase Auth a mensajes claros en español. */
function mapAuthError(message?: string): string {
  if (!message) return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  if (/invalid login credentials/i.test(message)) return "Credenciales incorrectas.";
  if (/email not confirmed/i.test(message))
    return "Debes confirmar tu correo antes de entrar.";
  if (/too many requests/i.test(message))
    return "Demasiados intentos. Espera un momento y vuelve a probarlo.";
  return "No se pudo iniciar sesión. Inténtalo de nuevo.";
}

/**
 * Consulta el branding público (RPC pre-auth). Devuelve null si la agencia
 * no existe o está inactiva: la función SQL filtra `a.active`.
 */
async function fetchBranding(slug: string): Promise<PublicBranding | null> {
  const supabase = createClient();
  // Un error de RPC se trata como fila nula -> la UI bloquea con mensaje.
  const { data } = await supabase.rpc("get_public_branding", {
    p_slug: slug,
  });
  return (data as PublicBranding[] | null)?.[0] ?? null;
}

export function LoginForm({
  initialSlug,
  nextPath,
  authError,
  agencyError,
}: LoginFormProps) {
  const router = useRouter();

  // Slug efectivo: ?agencia= tiene prioridad sobre el recordado en localStorage.
  const storedSlug = useSyncExternalStore(subscribeNoop, getStoredSlug, getServerSlug);
  const effectiveSlug = initialSlug ?? storedSlug;

  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [slugInput, setSlugInput] = useState(initialSlug ?? "");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Aplica el resultado del branding (éxito o bloqueo). Solo se invoca desde
   * callbacks de promesas, nunca de forma síncrona dentro de un efecto.
   */
  const applyBranding = useCallback((slug: string, row: PublicBranding | null) => {
    if (!row) {
      // Inexistente o inactiva: bloqueo claro.
      setBranding(null);
      setSlugError(AGENCY_UNAVAILABLE);
      return;
    }
    window.localStorage.setItem(AGENCY_SLUG_STORAGE_KEY, slug);
    setBranding(row);
    setSlugError(null);
  }, []);

  // Auto-resuelve el slug recordado/en URL. El estado "cargando" se deriva
  // (`step`); los setState ocurren en el callback de la promesa (patrón
  // recomendado por react-hooks para sistemas externos).
  useEffect(() => {
    if (!effectiveSlug || branding) return;
    let cancelled = false;

    void fetchBranding(effectiveSlug).then((row) => {
      if (!cancelled) applyBranding(effectiveSlug, row);
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, branding, applyBranding]);

  // Paso de UI derivado del estado, sin máquina imperativa.
  const step: Step = branding ? "form" : effectiveSlug && !slugError ? "cargando" : "slug";

  function handleSlugSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = slugInput.trim().toLowerCase();
    if (!slug) {
      setSlugError("Introduce el identificador de tu agencia.");
      return;
    }
    setCheckingSlug(true);
    void fetchBranding(slug)
      .then((row) => applyBranding(slug, row))
      .finally(() => setCheckingSlug(false));
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setMagicSent(false);

    if (!email.trim() || !password) {
      setFormError("Introduce tu correo y tu contraseña.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError(mapAuthError(error.message));
        return;
      }
      // O1: re-validación en cliente por defensa en profundidad.
      router.replace(sanitizeNextPath(nextPath));
    } catch {
      setFormError("No se pudo iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink() {
    setFormError(null);
    setMagicSent(false);

    if (!email.trim()) {
      setFormError("Introduce tu correo para recibir el enlace.");
      return;
    }

    setSubmitting(true);
    try {
      const origin = window.location.origin;
      const nextQuery = sanitizeNextPath(nextPath);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo:
            nextQuery === "/"
              ? `${origin}/auth/callback`
              : `${origin}/auth/callback?next=${encodeURIComponent(nextQuery)}`,
        },
      });

      if (error) {
        setFormError(mapAuthError(error.message));
        return;
      }
      setMagicSent(true);
    } catch {
      setFormError("No se pudo enviar el enlace. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  const brandColor = branding?.primary_color || "#2563eb";
  const banner = agencyError
    ? AGENCY_UNAVAILABLE
    : authError
      ? AUTH_ERROR_BANNER
      : null;

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-[#F8F9FA] px-4 py-10"
      style={{ ["--brand" as string]: brandColor }}
    >
      <main className="w-full max-w-sm">
        {/* Branding de la agencia */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo_url puede apuntar a cualquier host del bucket público
            <img
              src={branding.logo_url}
              alt={`Logo de ${branding.name}`}
              className="h-12 w-auto object-contain"
            />
          ) : (
            <span
              className="flex size-12 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: brandColor }}
            >
              <Building2 className="size-6" aria-hidden />
            </span>
          )}
          <h1 className="text-xl font-semibold tracking-tight">
            {branding ? branding.name : "CRM Inmobiliario"}
          </h1>
        </div>

        {banner ? (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive"
          >
            {banner}
          </p>
        ) : null}

        {step === "cargando" ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-10 shadow-xs">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Cargando…</p>
          </div>
        ) : step === "slug" ? (
          /* Paso 1: identificar la agencia */
          <form
            onSubmit={handleSlugSubmit}
            className="rounded-xl border bg-card px-6 py-8 shadow-xs"
            noValidate
          >
            <h2 className="text-base font-semibold">Acceso a la intranet</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
              Introduce el identificador de tu agencia para continuar.
            </p>

            <div className="grid gap-2">
              <Label htmlFor="agencia">Agencia</Label>
              <Input
                id="agencia"
                name="agencia"
                autoComplete="organization"
                placeholder="p. ej. fincas-madrid"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                aria-invalid={Boolean(slugError)}
                autoFocus
              />
            </div>

            {slugError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {slugError}
              </p>
            ) : null}

            <Button
              type="submit"
              className="mt-5 h-9 w-full"
              style={{ backgroundColor: brandColor }}
              disabled={checkingSlug}
            >
              {checkingSlug ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Comprobando…
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </form>
        ) : (
          /* Paso 2: credenciales */
          <form
            onSubmit={handlePasswordSubmit}
            className="rounded-xl border bg-card px-6 py-8 shadow-xs"
            noValidate
          >
            <h2 className="text-base font-semibold">Inicia sesión</h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">
              Accede con tu cuenta profesional.
            </p>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nombre@agencia.es"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(formError)}
                />
              </div>
            </div>

            {formError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            {magicSent ? (
              <p
                role="status"
                className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
              >
                Te hemos enviado un enlace de acceso a tu correo. Revisa también
                la carpeta de spam.
              </p>
            ) : null}

            <Button
              type="submit"
              className="mt-5 h-9 w-full"
              style={{ backgroundColor: brandColor }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Entrando…
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>

            <button
              type="button"
              onClick={() => void handleMagicLink()}
              disabled={submitting}
              className="mt-3 w-full text-center text-sm font-medium underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
              style={{ color: brandColor }}
            >
              Recibir enlace mágico por correo
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
