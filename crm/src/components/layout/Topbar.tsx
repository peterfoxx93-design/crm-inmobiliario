"use client";

import { AvisosBell } from "@/components/layout/AvisosBell";
import { CreateMenu } from "@/components/layout/CreateMenu";
import { UniversalSearch } from "@/components/layout/UniversalSearch";
import { UserMenu } from "@/components/layout/UserMenu";
import type { ProfileRole } from "@/lib/types";

interface TopbarProps {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: ProfileRole;
  /**
   * Clase de `top-` del sticky (Task 17): "top-10" cuando hay banner de
   * suplantacion encima, "top-0" por defecto.
   */
  stickyTopClass?: string;
}

/**
 * Barra superior sticky (brief Step 2): busqueda universal, "+ Crear",
 * campana de avisos y menu de usuario.
 */
export function Topbar({
  fullName,
  email,
  avatarUrl,
  role,
  stickyTopClass = "top-0",
}: TopbarProps) {
  return (
    <header
      className={`sticky ${stickyTopClass} z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:px-6`}
    >
      <UniversalSearch />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* En movil el "+ Crear" vive en el FAB; se muestra desde sm */}
        <div className="hidden sm:block">
          <CreateMenu />
        </div>
        <AvisosBell />
        <UserMenu
          fullName={fullName}
          email={email}
          avatarUrl={avatarUrl}
          role={role}
        />
      </div>
    </header>
  );
}
