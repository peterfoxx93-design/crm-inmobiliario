"use client";

import { Building2, Home, TrendingUp, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MOBILE_TABS } from "@/lib/nav";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<string, LucideIcon> = {
  "/dashboard": Home,
  "/propiedades": Building2,
  "/contactos": Users,
  "/pipeline": TrendingUp,
};

/**
 * Barra de pestañas fija inferior en movil (< md), brief Step 3:
 * Inicio, Propiedades, Contactos y Pipeline. Oculta en escritorio.
 */
export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {MOBILE_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab.href] ?? Home;
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none transition-colors",
              active ? "text-[var(--brand)]" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
