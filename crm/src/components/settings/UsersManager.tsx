"use client";

/**
 * Tab "Usuarios" de Ajustes (Task 16): tabla de perfiles de la agencia,
 * dialogo de invitacion y desactivar/reactivar acceso. Solo la ve un admin;
 * el guard real vive en las server actions (lib/admin-users.ts).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  deactivateUserAction,
  inviteUserAction,
  reactivateUserAction,
} from "@/app/actions/my-agency";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AgencyUserView {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "agent" | "super_admin";
  avatarUrl: string | null;
  active: boolean;
}

interface UsersManagerProps {
  users: AgencyUserView[];
  /** Perfil del actor: para saber que fila es la suya (no autodesactivable). */
  currentUserId: string;
}

const ROLE_LABEL: Record<AgencyUserView["role"], string> = {
  admin: "Administrador",
  agent: "Agente",
  super_admin: "Superadmin",
};

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function UsersManager({ users, currentUserId }: UsersManagerProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [sending, setSending] = useState(false);
  // Miembro pendiente de desactivar: segundo paso de confirmacion.
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function handleInvite() {
    setSending(true);
    const result = await inviteUserAction({
      fullName,
      email,
      role,
    });
    setSending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`Invitación creada para ${email}.`);
    setInviteOpen(false);
    setFullName("");
    setEmail("");
    setRole("agent");
    router.refresh();
  }

  async function handleSetActive(userId: string, active: boolean) {
    setWorkingId(userId);
    const result = await (active ? reactivateUserAction : deactivateUserAction)(
      userId,
    );
    setWorkingId(null);
    setPendingDisable(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(
      active
        ? "Acceso reactivado."
        : "Acceso desactivado. El usuario no podrá iniciar sesión.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {users.length} {users.length === 1 ? "miembro" : "miembros"} en la
          agencia.
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus data-icon="inline-start" aria-hidden />
          Invitar usuario
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8">
                      {/* Las avatares remotas requieren config de dominios; fallback con iniciales siempre seguro. */}
                      <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {user.fullName}
                      {user.id === currentUserId && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (tú)
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.email || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {ROLE_LABEL[user.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.active ? (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Desactivado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {user.id === currentUserId ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : user.active ? (
                    pendingDisable === user.id ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={workingId !== null}
                          onClick={() => handleSetActive(user.id, false)}
                        >
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={workingId !== null}
                          onClick={() => setPendingDisable(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingDisable(user.id)}
                      >
                        Desactivar acceso
                      </Button>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={workingId !== null}
                      onClick={() => handleSetActive(user.id, true)}
                    >
                      Reactivar acceso
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no hay miembros en la agencia. Invita al primero.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
            <DialogDescription>
              Se creará la cuenta con acceso a esta agencia. Podrá completar su
              entrada desde el enlace de invitación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nombre</Label>
              <Input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ana García"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana@agencia.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rol</Label>
              <Select
                value={role}
                onValueChange={(value) =>
                  setRole(value === "admin" ? "admin" : "agent")
                }
              >
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setInviteOpen(false)}
              disabled={sending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleInvite()}
              disabled={
                sending || !fullName.trim() || !email.trim() || !email.includes("@")
              }
            >
              <ShieldCheck data-icon="inline-start" aria-hidden />
              {sending ? "Creando…" : "Crear invitación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
