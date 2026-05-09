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
import { Plus, Pencil, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useServerFn } from "@tanstack/react-start";
import { importProductsXlsx } from "@/lib/products-import.functions";

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
        <div className="flex gap-2">
          <ImportXlsxButton onDone={load} />
          <Button onClick={newOne}><Plus className="mr-2 h-4 w-4" /> Novo</Button>
        </div>
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

type ImportResult = Awaited<ReturnType<typeof importProductsXlsx>>;

function ImportXlsxButton({ onDone }: { onDone: () => void }) {
  const importFn = useServerFn(importProductsXlsx);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [open, setOpen] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
      if (rows.length === 0) {
        toast.error("Planilha vazia");
        return;
      }
      const res = await importFn({ data: { rows: rows as never } });
      setResult(res);
      setOpen(true);
      if (res.inserted > 0) toast.success(`${res.inserted} produto(s) importado(s)`);
      if (res.errors.length > 0) toast.warning(`${res.errors.length} linha(s) com erro`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      {
        name: "X-Burger",
        description: "Pão, hambúrguer, queijo",
        price: 18.9,
        categoria: "Lanches",
        external_code: "100",
        is_available: true,
        sort_order: 1,
        image_url: "https://...",
        // exemplo de campo extra (vai para extra_fields automaticamente)
        ingredientes: "pão, carne, queijo",
        peso_g: 220,
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "produtos");
    XLSX.writeFile(wb, "modelo-produtos.xlsx");
  }

  return (
    <>
      <Button variant="outline" onClick={downloadTemplate} type="button">
        <FileSpreadsheet className="mr-2 h-4 w-4" /> Modelo
      </Button>
      <Button asChild variant="outline" disabled={busy}>
        <label className="cursor-pointer">
          <Upload className="mr-2 h-4 w-4" />
          {busy ? "Importando..." : "Importar XLSX"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Resultado da importação</DialogTitle></DialogHeader>
          {result && (
            <div className="space-y-3 text-sm">
              <p><strong>{result.inserted}</strong> de {result.total} produto(s) inseridos.</p>
              {result.newCategories.length > 0 && (
                <p className="text-muted-foreground">Categorias criadas: {result.newCategories.join(", ")}</p>
              )}
              {result.newColumns.length > 0 && (
                <div>
                  <p className="font-medium">Campos extras detectados ({result.newColumns.length}):</p>
                  <p className="text-xs text-muted-foreground">
                    {result.newColumns.join(", ")}
                  </p>
                  <p className="mt-1 text-xs">
                    {result.extraFieldsAvailable
                      ? "Salvos automaticamente em products.extra_fields (JSONB)."
                      : "⚠️ Coluna extra_fields ausente. Estes campos foram ignorados."}
                  </p>
                </div>
              )}
              {!result.extraFieldsAvailable && result.hint && (
                <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">{result.hint}</pre>
              )}
              {result.errors.length > 0 && (
                <div>
                  <p className="font-medium text-destructive">Erros ({result.errors.length}):</p>
                  <ul className="max-h-40 overflow-y-auto text-xs">
                    {result.errors.map((e, i) => (
                      <li key={i}>Linha {e.row}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
