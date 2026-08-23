"use client";

import type { ReactNode } from "react";

import { BottomBar } from "@/components/layout/BottomBar";
import { Fab } from "@/components/layout/Fab";
import { Sidebar, useSidebarCollapsed } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { ProfileRole } from "@/lib/types";

export interface ShellUser {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: ProfileRole;
}

interface AppShellProps {
  user: ShellUser;
  agencyName: string;
  agencyLogoUrl: string | null;
  children: ReactNode;
}

/**
 * Composicion del shell autenticado (Task 7):
 * - Escritorio (>= md): Sidebar fijo colapsable + Topbar sticky.
 * - Movil (< md): Topbar + BottomBar fija + FAB de creacion rapida.
 * El ancho del sidebar se expone como `--sidebar-w` para que el contenido
 * se desplace en sync con el estado colapsado.
 */
export function AppShell({ user, agencyName, agencyLogoUrl, children }: AppShellProps) {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <div
      style={{ "--sidebar-w": collapsed ? "3.5rem" : "15rem" } as React.CSSProperties}
      className="min-h-dvh bg-[#F8F9FA]"
    >
      <Sidebar
        agencyName={agencyName}
        agencyLogoUrl={agencyLogoUrl}
        role={user.role}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="flex min-h-dvh flex-col transition-[padding] duration-200 md:pl-[var(--sidebar-w)]">
        <Topbar
          fullName={user.fullName}
          email={user.email}
          avatarUrl={user.avatarUrl}
          role={user.role}
        />
        {/* Padding inferior extra en movil para no quedar bajo la BottomBar */}
        <main className="flex flex-1 flex-col px-4 pt-4 pb-24 md:px-6 md:pb-6">
          {children}
        </main>
      </div>
      <BottomBar />
      <Fab />
    </div>
  );
}
