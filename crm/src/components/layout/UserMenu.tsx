"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/types";

const ROLE_LABELS: Record<ProfileRole, string> = {
  super_admin: "Super admin",
  admin: "Administración",
  agent: "Agente",
};

interface UserMenuProps {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: ProfileRole;
}

/** Iniciales para el fallback del avatar (max. 2). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Menu de usuario del topbar (brief Step 2): nombre + avatar y "Salir"
 * (signOut). Cierra sesion en Supabase Auth y vuelve a /login.
 */
export function UserMenu({ fullName, email, avatarUrl, role }: UserMenuProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de usuario"
        className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-1.5 outline-none transition-colors select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
      >
        <Avatar className="size-7">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials(fullName)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">
          {fullName}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{fullName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {email}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {ROLE_LABELS[role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void handleSignOut()}>
          <LogOut aria-hidden />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
