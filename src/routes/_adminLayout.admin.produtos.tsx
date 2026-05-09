import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Category } from "@/lib/menu-types";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_adminLayout/admin/produtos")({
  component: ProductsAdmin,
  head: () => ({ meta: [{ title: "Admin — Produtos" }] }),
});

function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [p, c] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setProducts((p.data as Product[]) ?? []);
    setCategories((c.data as Category[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function newOne() {
    setEditing({
      id: "",
      category_id: categories[0]?.id ?? "",
      name: "",
      description: "",
      price: 0,
      image_url: "",
      is_available: true,
      sort_order: 0,
      external_code: "",
      created_at: "",
    });
    setOpen(true);
  }

  async function save(p: Product) {
    const payload = {
      category_id: p.category_id,
      name: p.name.trim(),
      description: p.description?.trim() || null,
      price: Number(p.price),
      image_url: p.image_url?.trim() || null,
      is_available: p.is_available,
      sort_order: Number(p.sort_order) || 0,
      external_code: p.external_code?.trim() || null,
    };
    if (!payload.name || !payload.category_id) { toast.error("Nome e categoria obrigatórios"); return; }
    const { error } = p.id
      ? await supabase.from("products").update(payload).eq("id", p.id)
      : await supabase.from("products").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Salvo"); setOpen(false); load(); }
  }

  async function del(id: string) {
    if (!confirm("Excluir produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl">Produtos</h1>
          <p className="text-sm text-muted-foreground">{products.length} produto(s)</p>
        </div>
        <Button onClick={newOne}><Plus className="mr-2 h-4 w-4" /> Novo</Button>
      </div>

      <div className="grid gap-3">
        {products.map((p) => (
          <article key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-2xl">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : "🍔"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{categories.find((c) => c.id === p.category_id)?.name ?? "—"}</p>
            </div>
            <span className="font-display text-primary">{brl(Number(p.price))}</span>
            <Switch
              checked={p.is_available}
              onCheckedChange={async (v) => {
                await supabase.from("products").update({ is_available: v }).eq("id", p.id);
                load();
              }}
            />
            <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
          </article>
        ))}
        {products.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum produto.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editing.category_id} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Imagem (URL)</Label>
                <Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Código PDV (externalCode Consumer)</Label>
                <Input
                  value={editing.external_code ?? ""}
                  onChange={(e) => setEditing({ ...editing, external_code: e.target.value })}
                  placeholder="ex: 112"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Usado pela integração do Programa Consumer para identificar o produto.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Disponível no cardápio</Label>
                <Switch checked={editing.is_available} onCheckedChange={(v) => setEditing({ ...editing, is_available: v })} />
              </div>
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
