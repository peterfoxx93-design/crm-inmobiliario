import "server-only";

import { Resend } from "resend";

/**
 * Notificacion por email de leads web via Resend (Task 18). SOLO SERVIDOR.
 *
 * Regla del brief: BEST-EFFORT. Un fallo de email (sin API key, sin
 * destinatarios, error de red o de cuota) JAMAS rompe el POST publico: la
 * funcion devuelve false y loguea, pero no lanza. El lead ya esta en BD;
 * el email es solo el aviso a los admins de la agencia.
 */

/** Remitente configurable; el dominio por defecto es el sandbox de Resend. */
const DEFAULT_FROM = "CRM Inmobiliario <onboarding@resend.dev>";

export interface LeadEmailPayload {
  agencyName: string;
  fullName: string;
  phone: string;
  email?: string;
  message?: string;
}

/**
 * Escape HTML minimo: el contenido del lead lo controla un anonimo de
 * internet y acaba incrustado en un email HTML. Nunca interpolar crudo.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Cuerpo HTML plano y legible (sin dependencias de plantillas). */
export function buildLeadEmailHtml(payload: LeadEmailPayload): string {
  const row = (label: string, value: string | null | undefined): string =>
    value
      ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`
      : "";

  const messageBlock = payload.message
    ? `<p style="margin:16px 0 0;"><strong>Mensaje:</strong><br/>${escapeHtml(payload.message)}</p>`
    : "";

  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;">
  <h2 style="margin:0 0 12px;">Nuevo lead desde la web</h2>
  <p style="margin:0 0 8px;">Un visitante ha rellenado el formulario de <strong>${escapeHtml(payload.agencyName)}</strong>:</p>
  <table style="border-collapse:collapse;">
    ${row("Nombre", payload.fullName)}
    ${row("Telefono", payload.phone)}
    ${row("Email", payload.email)}
  </table>
  ${messageBlock}
</div>`;
}

/**
 * Envia la notificacion a los destinatarios dados. Devuelve true si Resend
 * acepto el envio; false en cualquier otro caso (nunca lanza).
 */
export async function sendLeadNotification(
  payload: LeadEmailPayload,
  recipients: string[],
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || recipients.length === 0) {
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.LEADS_EMAIL_FROM || DEFAULT_FROM,
      to: recipients,
      subject: `Nuevo lead web: ${payload.fullName}`,
      html: buildLeadEmailHtml(payload),
    });
    if (error) {
      console.error("[lib/email] Resend rechazo el envio:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    // Best-effort: cualquier excepcion (red, cuota, key invalida) se traga.
    console.error("[lib/email] fallo al enviar la notificacion de lead:", error);
    return false;
  }
}
