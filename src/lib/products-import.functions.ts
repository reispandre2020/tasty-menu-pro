import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Campos nativos da tabela products
const KNOWN_FIELDS = new Set([
  "name",
  "description",
  "price",
  "image_url",
  "is_available",
  "sort_order",
  "external_code",
  "category_id",
]);

// Aliases comuns (PT-BR / variações) → coluna nativa
const FIELD_ALIASES: Record<string, string> = {
  nome: "name",
  produto: "name",
  descricao: "description",
  descrição: "description",
  preco: "price",
  preço: "price",
  valor: "price",
  imagem: "image_url",
  foto: "image_url",
  image: "image_url",
  url_imagem: "image_url",
  disponivel: "is_available",
  disponível: "is_available",
  ativo: "is_available",
  ordem: "sort_order",
  sort: "sort_order",
  codigo: "external_code",
  código: "external_code",
  codigo_pdv: "external_code",
  external_code: "external_code",
  sku: "external_code",
  categoria: "__category_name",
  category: "__category_name",
  category_name: "__category_name",
};

const RowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

const Input = z.object({
  rows: z.array(RowSchema).min(1).max(2000),
});

function normalizeKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  return ["1", "true", "sim", "yes", "y", "s", "ativo", "disponivel", "disponível"].includes(s);
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export const importProductsXlsx = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    // Garante que a coluna extra_fields existe — tenta um select; se falhar, retorna instrução.
    const probe = await supabaseAdmin.from("products").select("extra_fields").limit(1);
    const hasExtra = !probe.error;

    // Carrega categorias (para resolver/criar por nome)
    const { data: cats } = await supabaseAdmin.from("categories").select("id,name");
    const catByName = new Map<string, string>(
      (cats ?? []).map((c: { id: string; name: string }) => [c.name.trim().toLowerCase(), c.id]),
    );

    const created: string[] = [];
    const errors: { row: number; message: string }[] = [];
    const newColumns = new Set<string>();
    let inserted = 0;

    for (let i = 0; i < data.rows.length; i++) {
      const raw = data.rows[i];
      const mapped: Record<string, unknown> = {};
      const extras: Record<string, unknown> = {};
      let categoryName: string | null = null;

      for (const [k, v] of Object.entries(raw)) {
        if (v === null || v === undefined || v === "") continue;
        const nk = normalizeKey(k);
        const alias = FIELD_ALIASES[nk] ?? nk;
        if (alias === "__category_name") {
          categoryName = String(v).trim();
        } else if (KNOWN_FIELDS.has(alias)) {
          mapped[alias] = v;
        } else {
          extras[k] = v;
          newColumns.add(k);
        }
      }

      if (!mapped.name) {
        errors.push({ row: i + 2, message: "Coluna 'name/nome' obrigatória" });
        continue;
      }

      // Resolve / cria categoria
      let categoryId = mapped.category_id as string | undefined;
      if (!categoryId && categoryName) {
        const found = catByName.get(categoryName.toLowerCase());
        if (found) {
          categoryId = found;
        } else {
          const ins = await supabaseAdmin
            .from("categories")
            .insert({ name: categoryName, sort_order: 0, is_active: true })
            .select("id")
            .single();
          if (ins.error) {
            errors.push({ row: i + 2, message: `Categoria: ${ins.error.message}` });
            continue;
          }
          categoryId = ins.data.id;
          catByName.set(categoryName.toLowerCase(), categoryId);
          created.push(`categoria: ${categoryName}`);
        }
      }
      if (!categoryId) {
        // Pega/Cria categoria padrão
        let def = catByName.get("geral");
        if (!def) {
          const ins = await supabaseAdmin
            .from("categories")
            .insert({ name: "Geral", sort_order: 0, is_active: true })
            .select("id")
            .single();
          if (!ins.error) {
            def = ins.data.id;
            catByName.set("geral", def);
          }
        }
        categoryId = def!;
      }

      const payload: Record<string, unknown> = {
        category_id: categoryId,
        name: String(mapped.name).trim(),
        description: mapped.description ? String(mapped.description) : null,
        price: mapped.price !== undefined ? toNum(mapped.price) : 0,
        image_url: mapped.image_url ? String(mapped.image_url) : null,
        is_available: mapped.is_available !== undefined ? toBool(mapped.is_available) : true,
        sort_order: mapped.sort_order !== undefined ? Math.trunc(toNum(mapped.sort_order)) : 0,
        external_code: mapped.external_code ? String(mapped.external_code) : null,
      };
      if (hasExtra && Object.keys(extras).length > 0) {
        payload.extra_fields = extras;
      }

      const ins = await supabaseAdmin.from("products").insert(payload);
      if (ins.error) {
        errors.push({ row: i + 2, message: ins.error.message });
      } else {
        inserted++;
      }
    }

    return {
      inserted,
      total: data.rows.length,
      errors,
      newCategories: created,
      newColumns: Array.from(newColumns),
      extraFieldsAvailable: hasExtra,
      hint: hasExtra
        ? null
        : "Para salvar campos extras automaticamente, rode no SQL Editor: ALTER TABLE public.products ADD COLUMN IF NOT EXISTS extra_fields jsonb NOT NULL DEFAULT '{}'::jsonb;",
    };
  });
