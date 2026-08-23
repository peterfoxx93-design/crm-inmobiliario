interface LeadBasico {
  id: string;
}

/**
 * Excluye de la lista de leads aquellos cuyo id aparece en `idsConActividad`
 * (contactos con actividades registradas en las últimas 24h). Un conjunto
 * vacio —p. ej. si la consulta de actividad fallo— devuelve la lista intacta,
 * degradando al comportamiento anterior sin romper.
 */
export function filtrarLeadsSinActividadReciente<T extends LeadBasico>(
  leads: T[],
  idsConActividad: ReadonlySet<string>,
): T[] {
  return leads.filter((lead) => !idsConActividad.has(lead.id));
}
