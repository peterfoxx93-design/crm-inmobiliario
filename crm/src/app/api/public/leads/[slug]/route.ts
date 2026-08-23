import { NextResponse, type NextRequest } from "next/server";

import { createAdminSupabase } from "@/lib/admin-users";
import { sendLeadNotification } from "@/lib/email";
import { readBodyCapped } from "@/lib/request-body";
import {
  DEFAULT_LEAD_RATE_LIMIT,
  createSlidingWindowLimiter,
  extractClientIp,
} from "@/lib/rate-limit";
import {
  decideLeadUpsert,
  isHoneypotFilled,
  publicLeadSchema,
} from "@/lib/validators/lead";

/**
 * Endpoint PUBLICO de captacion de leads (Task 18): POST /api/public/leads/[slug]
 *
 * DEVIACION DEL PATRON DE LA APP (deliberada): el resto de handlers de la app
 * exigen sesion; este endpoint es el unico sin auth porque lo consume un
 * formulario embebible en webs de terceros via iframe. El middleware ya excluye
 * `api/public/` del guard de sesion. Compensaciones de seguridad:
 *   1. Validacion estricta Zod en el boundary (payload anonimo = hostil).
 *   2. Rate limit 5 req/min/IP (ventana deslizante en memoria).
 *   3. Honeypot `companyUrl`: relleno -> exito falso silencioso, sin tocar BD.
 *   4. El slug se resuelve contra `agencies` con service_role SOLO tras los
 *      filtros anteriores y exigiendo agencia activa + web_form.enabled
 *      (patron Task 6: guard servidor-a-servidor; nunca exponer la key).
 *   5. CORS abierto SOLO aqui: el iframe externo necesita POST cross-origin.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

/** Cota dura de payload: un lead legitimo nunca pasa de unos pocos KB. */
const MAX_BODY_BYTES = 16 * 1024;

/** Limiter por proceso (ver limitacion documentada en lib/rate-limit.ts). */
const limiter = createSlidingWindowLimiter(DEFAULT_LEAD_RATE_LIMIT);

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function jsonResponse(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: CORS_HEADERS,
  });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  // 1) Rate limit ANTES de leer el cuerpo (proteccion basica anti-DoS).
  const ip = extractClientIp((name) => request.headers.get(name));
  const rateKey = ip || "sin-ip";
  const rate = limiter.check(rateKey);
  if (!rate.allowed) {
    return jsonResponse(
      { ok: false, error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." },
      429,
    );
  }

  // 2) Lectura del cuerpo con COTA DURA de bytes (review B2): se consume el
  //    stream por chunks y se corta al superar MAX_BODY_BYTES. No se confia
  //    en content-length (mintible) ni en request.json() (bufferiza todo).
  const capped = await readBodyCapped(request.body, MAX_BODY_BYTES);
  if (capped.kind === "too_large") {
    return jsonResponse({ ok: false, error: "Solicitud demasiado grande." }, 400);
  }
  if (capped.kind !== "text") {
    return jsonResponse({ ok: false, error: "Solicitud no válida." }, 400);
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(capped.text);
  } catch {
    return jsonResponse({ ok: false, error: "Solicitud no válida." }, 400);
  }
  if (rawBody === null || typeof rawBody !== "object") {
    return jsonResponse({ ok: false, error: "Solicitud no válida." }, 400);
  }

  // 3) Validacion estricta del boundary.
  const parsed = publicLeadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Los datos introducidos no son válidos.",
      },
      400,
    );
  }
  const lead = parsed.data;

  // 4) HONEYPOT: bot detectado -> exito falso silencioso (200), cero BD.
  if (isHoneypotFilled(lead.companyUrl)) {
    return jsonResponse({ ok: true }, 200);
  }

  // 5) Slug valido -> agencia ACTIVA con captacion habilitada. Unico punto
  //    donde entra service_role, ya con payload validado y rate limitado.
  const { slug } = await context.params;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return jsonResponse({ ok: false, error: "Formulario no disponible." }, 404);
  }

  const admin = createAdminSupabase();
  const { data: agency } = await admin
    .from("agencies")
    .select("id, name, settings")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  type WebFormSettings = {
    enabled?: boolean;
    showEmail?: boolean;
    showMessage?: boolean;
    thanksMessage?: string;
  };
  const settings = (agency?.settings ?? {}) as Record<string, unknown>;
  const webForm = (settings.web_form ?? {}) as WebFormSettings;

  if (!agency || !webForm.enabled) {
    return jsonResponse({ ok: false, error: "Formulario no disponible." }, 404);
  }

  // 6) Upsert por telefono dentro de la agencia (decision pura testeada).
  //    .limit(1) con orden determinista (review R2): si hubiera duplicados
  //    del mismo telefono, maybeSingle() a secas daria error -> null ->
  //    insertaria OTRO duplicado. Con limit(1) se anade la actividad al
  //    contacto mas antiguo y nunca se multiplica la fila.
  const existing = await admin
    .from("contacts")
    .select("id")
    .eq("agency_id", agency.id as string)
    .eq("phone", lead.phone)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const decision = decideLeadUpsert(
    existing.data?.id ?? null,
    agency.id as string,
    lead,
    new Date().toISOString(),
  );

  if (decision.kind === "nuevo") {
    const { error: insertError } = await admin
      .from("contacts")
      .insert(decision.contact);
    if (insertError) {
      console.error("[api/public/leads] insert contacto:", insertError.message);
      return jsonResponse(
        { ok: false, error: "No se ha podido registrar la solicitud." },
        500,
      );
    }
  } else {
    // La actividad exige created_by NOT NULL -> perfil admin de la agencia
    // (fallback: cualquier perfil de la agencia). Si no hay ninguno, el lead
    // existente sigue siendo valido: se responde 201 sin actividad nueva.
    const { data: author } = await admin
      .from("profiles")
      .select("id")
      .eq("agency_id", agency.id as string)
      .in("role", ["admin", "agent", "super_admin"])
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (author) {
      const { error: activityError } = await admin.from("activities").insert({
        ...decision.activity,
        agency_id: agency.id as string,
        created_by: author.id as string,
      });
      if (activityError) {
        console.error(
          "[api/public/leads] insert actividad:",
          activityError.message,
        );
      }
    }
  }

  // 7) Email a los admins de la agencia: best-effort, JAMAS rompe el POST.
  try {
    const { data: adminProfiles } = await admin
      .from("profiles")
      .select("id")
      .eq("agency_id", agency.id as string)
      .eq("role", "admin");

    let recipients: string[] = [];
    if (adminProfiles && adminProfiles.length > 0) {
      // profiles no guarda email: se resuelve contra Auth Admin (service_role).
      const adminIds = new Set(adminProfiles.map((p) => p.id as string));
      for (let page = 1; page <= 10 && recipients.length === 0; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error || !data) break;
        recipients = data.users
          .filter((u) => adminIds.has(u.id) && u.email)
          .map((u) => u.email as string);
        if (data.users.length < 200) break;
      }
    }

    await sendLeadNotification(
      {
        agencyName: agency.name as string,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email || undefined,
        message: lead.message || undefined,
      },
      recipients,
    );
  } catch (emailError) {
    console.error("[api/public/leads] aviso por email:", emailError);
  }

  return jsonResponse({ ok: true }, 201);
}
