import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/menu-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_adminLayout/admin/categorias")({
  component: CategoriesAdmin,
  head: () => ({ meta: [{ title: "Admin — Categorias" }] }),
});

function CategoriesAdmin() {
  const [items, setItems] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setItems((data as Category[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function newOne() {
    setEditing({ id: "", name: "", description: "", sort_order: items.length, is_active: true, created_at: "" });
    setOpen(true);
  }

  async function save(c: Category) {
    const payload = {
      name: c.name.trim(),
      description: c.description?.trim() || null,
      sort_order: Number(c.sort_order) || 0,
      is_active: c.is_active,
    };
    if (!payload.name) { toast.error("Nome obrigatório"); return; }
    const { error } = c.id
      ? await supabase.from("categories").update(payload).eq("id", c.id)
      : await supabase.from("categories").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Salvo"); setOpen(false); load(); }
  }

  async function del(id: string) {
    if (!confirm("Excluir categoria? Os produtos vinculados também serão removidos.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl">Categorias</h1>
          <p className="text-sm text-muted-foreground">{items.length} categoria(s)</p>
        </div>
        <Button onClick={newOne}><Plus className="mr-2 h-4 w-4" /> Nova</Button>
      </div>

      <div className="grid gap-3">
        {items.map((c) => (
          <article key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{c.name}</p>
              {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
            </div>
            <Switch checked={c.is_active} onCheckedChange={async (v) => { await supabase.from("categories").update({ is_active: v }).eq("id", c.id); load(); }} />
            <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
          </article>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><Label>Ativa</Label><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => editing && save(editing)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
