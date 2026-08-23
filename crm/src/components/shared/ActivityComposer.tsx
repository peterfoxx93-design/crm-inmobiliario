"use client";

/**
 * Composer de actividades (Task 12): modal compartido para Llamada / Email /
 * Nota / Tarea desde QuickActions. Llama a la server action addActivity.
 */

import { useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_TYPE_META } from "@/lib/constants";
import { addActivity, type AddActivityInput } from "@/app/actions/contacts";
import type { ActivityType } from "@/lib/types";

export interface ActivityComposerProps {
  type: ActivityType;
  contactId?: string;
  propertyId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ActivityComposer({
  type,
  contactId,
  propertyId,
  open,
  onOpenChange,
  onSaved,
}: ActivityComposerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, setIsPending] = useState(false);
  const meta = ACTIVITY_TYPE_META[type];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsPending(true);

    const payload: AddActivityInput = {
      type: type as AddActivityInput["type"],
      title: title.trim(),
      body: body.trim() || undefined,
      contactId,
      propertyId,
      dueDate:
        type === "tarea" && dueDate ? dueDate : undefined,
    };
    const result = await addActivity(payload);
    setIsPending(false);

    if (result.ok) {
      toast.success("Actividad registrada.");
      setTitle("");
      setBody("");
      setDueDate("");
      onOpenChange(false);
      onSaved?.();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva actividad · {meta.label}</DialogTitle>
          <DialogDescription>
            Quedará registrada en la timeline del contacto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="activity-title">Título</Label>
            <Input
              id="activity-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                type === "llamada" ? "Llamada de seguimiento" : undefined
              }
              required
            />
          </div>

          {type === "tarea" && (
            <div className="space-y-1">
              <Label htmlFor="activity-due">Fecha límite</Label>
              <Input
                id="activity-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="activity-body">Detalle</Label>
            <Textarea
              id="activity-body"
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
