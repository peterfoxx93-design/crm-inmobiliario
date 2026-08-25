"use client";

import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Home,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";
import { getNavItems, type NavItem } from "@/lib/nav";
import type { ProfileRole } from "@/lib/types";

/** Clave de localStorage donde se recuerda el estado colapsado del sidebar. */
const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": Home,
  "/propiedades": Building2,
  "/contactos": Users,
  "/pipeline": TrendingUp,
  "/agenda": Calendar,
  "/ajustes": Settings,
  "/maestro": ShieldCheck,
};

interface SidebarProps {
  agencyName: string;
  agencyLogoUrl: string | null;
  role: ProfileRole;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Navegacion lateral de escritorio (>= md). Colapsable a iconos con estado
 * persistido en localStorage. Oculta en movil (ahi manda BottomBar).
 */
export function Sidebar({
  agencyName,
  agencyLogoUrl,
  role,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const items = getNavItems(role);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Logo + nombre de agencia */}
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b px-3",
          collapsed && "justify-center px-0",
        )}
      >
        {agencyLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo_url puede apuntar a cualquier host del bucket publico
          <img
            src={agencyLogoUrl}
            alt={`Logo de ${agencyName}`}
            className="h-8 w-auto max-w-24 shrink-0 object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--brand-fg)]"
            style={{ backgroundColor: "var(--brand)" }}
          >
            <Building2 className="size-4" />
          </span>
        )}
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight">
            {agencyName}
          </span>
        )}
        {!collapsed && <span className="sr-only">CRM Inmobiliario</span>}
      </div>

      {/* Navegacion principal */}
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto p-2">
        <ul className="grid gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <SidebarLink
                item={item}
                icon={NAV_ICONS[item.href] ?? Home}
                active={isActive(pathname, item.href)}
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Colapsar a iconos */}
      <div className="border-t p-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <>
              <ChevronLeft className="size-4" aria-hidden />
              Colapsar
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  icon: Icon,
  active,
  collapsed,
}: {
  item: NavItem;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium outline-none transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed && item.label}
    </Link>
  );
}

/** Suscriptores locales del estado colapsado (el evento `storage` no dispara en la misma pestana). */
const sidebarListeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    // localStorage no disponible (permisos): quedara expandido.
    return false;
  }
}

function persistCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Sin persistencia: el estado vive solo en memoria.
  }
  for (const notify of sidebarListeners) notify();
}

function subscribeCollapsed(onChange: () => void) {
  const storageHandler = () => onChange();
  sidebarListeners.add(onChange);
  window.addEventListener("storage", storageHandler);
  return () => {
    sidebarListeners.delete(onChange);
    window.removeEventListener("storage", storageHandler);
  };
}

function getServerCollapsed(): boolean {
  return false;
}

/**
 * Estado colapsado del sidebar persistido en localStorage, leido con
 * `useSyncExternalStore` para evitar desajustes de hidratacion.
 */
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    getServerCollapsed,
  );
  const toggle = useCallback(() => {
    persistCollapsed(!readCollapsed());
  }, []);
  return [collapsed, toggle];
}
