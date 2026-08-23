"use client";

import { Building2, Plus, UserPlus, CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Base visual del trigger, alineada con el Button "default" del design system. */
const buttonTriggerClasses =
  "inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/80 aria-expanded:bg-primary/80 [&_svg]:pointer-events-none [&_svg]:shrink-0";

interface CreateAction {
  label: string;
  href: string;
  icon: typeof Plus;
}

/** Destinos de creacion rapida (rutas nuevas; las paginas llegan en tareas posteriores). */
const CREATE_ACTIONS: readonly CreateAction[] = [
  { label: "Propiedad", href: "/propiedades/nuevo", icon: Building2 },
  { label: "Contacto", href: "/contactos/nuevo", icon: UserPlus },
  { label: "Tarea", href: "/agenda/nueva", icon: CalendarPlus },
];

interface CreateMenuProps {
  /**
   * "button": boton "+ Crear" del topbar (escritorio).
   * "fab": botón flotante redondo del movil.
   */
  variant?: "button" | "fab";
}

/**
 * Menu "+ Crear" (brief Step 2/3): Propiedad / Contacto / Tarea.
 * Se reutiliza en el Topbar (desktop) y en el Fab (movil).
 */
export function CreateMenu({ variant = "button" }: CreateMenuProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          // Misma base visual que el Button por defecto
          buttonTriggerClasses,
          variant === "fab"
            ? "size-14 rounded-full shadow-lg [&_svg]:size-6"
            : "h-9 gap-1.5 rounded-lg px-3",
        )}
        aria-label={variant === "fab" ? "Crear" : undefined}
      >
        <Plus aria-hidden />
        {variant === "button" && <span>Crear</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        {CREATE_ACTIONS.map((action) => (
          <DropdownMenuItem
            key={action.href}
            onSelect={() => router.push(action.href)}
          >
            <action.icon aria-hidden />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
