"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Command, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface PropertyHit {
  id: string;
  title: string;
  reference: string | null;
  city: string | null;
}

interface ContactHit {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
}

const MIN_TERM_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * Busqueda universal del topbar (brief Step 2): Command con debounce de 300ms
 * sobre properties (title/reference/city) y contacts (full_name/phone/email),
 * limit 5 por tabla. Navega al resultado. Tolerante a fallo: si la consulta
 * falla (p. ej. BD sin migrar) se muestra "sin resultados".
 */
export function UniversalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [properties, setProperties] = useState<PropertyHit[]>([]);
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const term = query.trim();
  const hasResults = properties.length > 0 || contacts.length > 0;

  // Cerrar el desplegable al hacer click fuera.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setProperties([]);
        setContacts([]);
        setLoading(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const safeTerm = term.replace(/[%,()]/g, " ").trim();
    if (safeTerm.length < MIN_TERM_LENGTH) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const like = `%${safeTerm}%`;
      // Cada bloqueo se tolera por separado: error -> lista vacia.
      const [propsRes, contactsRes] = await Promise.all([
        supabase
          .from("properties")
          .select("id,title,reference,city")
          .or(`title.ilike.${like},reference.ilike.${like},city.ilike.${like}`)
          .limit(5),
        supabase
          .from("contacts")
          .select("id,full_name,phone,email")
          .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
          .limit(5),
      ]);
      if (cancelled) return;
      setProperties((propsRes.data ?? []) as PropertyHit[]);
      setContacts((contactsRes.data ?? []) as ContactHit[]);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  function navigate(href: string) {
    setQuery("");
    setProperties([]);
    setContacts([]);
    router.push(href);
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      {/* cmdk filtra en cliente; el filtrado real lo hace Supabase */}
      <Command shouldFilter={false} className="rounded-lg! border bg-muted/40">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar propiedades o contactos…"
          aria-label="Buscar propiedades o contactos"
        />
      </Command>

      {term.length >= MIN_TERM_LENGTH && (loading || hasResults) ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1 rounded-lg border bg-popover p-1 shadow-md">
          {loading ? (
            <div className="grid gap-2 p-2" aria-busy="true" aria-label="Buscando…">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : hasResults ? (
            <>
              {properties.length > 0 && (
                <CommandGroup heading="Propiedades">
                  {properties.map((property) => (
                    <CommandItem
                      key={property.id}
                      value={property.id}
                      onSelect={() => navigate(`/propiedades/${property.id}`)}
                    >
                      <span className="truncate">{property.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {[property.reference, property.city]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {contacts.length > 0 && (
                <CommandGroup heading="Contactos">
                  {contacts.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={contact.id}
                      onSelect={() => navigate(`/contactos/${contact.id}`)}
                    >
                      <span className="truncate">{contact.full_name}</span>
                      <span className="ml-auto shrink-0 truncate pl-2 text-xs text-muted-foreground">
                        {contact.phone}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Sin resultados para «{term}».
            </p>
          )}
        </div>
      ) : null}
      {loading ? (
        <Loader2
          className="pointer-events-none absolute right-8 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
