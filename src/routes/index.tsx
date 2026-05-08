import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Plus, Minus, Trash2, Flame, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Product, StoreSettings } from "@/lib/menu-types";
import { brl } from "@/lib/format";
import { cartStore, cartTotal, useCart } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: MenuPage,
  head: () => ({
    meta: [
      { title: "Cardápio Digital — Burger House" },
      { name: "description", content: "Peça online: hambúrgueres, acompanhamentos e bebidas. Retirada, delivery ou mesa." },
      { property: "og:title", content: "Cardápio Digital — Burger House" },
      { property: "og:description", content: "Peça online: hambúrgueres, acompanhamentos e bebidas." },
    ],
  }),
});

function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const cart = useCart();

  useEffect(() => {
    (async () => {
      const [cats, prods, st] = await Promise.all([
        supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("products").select("*").eq("is_available", true).order("sort_order"),
        supabase.from("store_settings").select("*").limit(1).maybeSingle(),
      ]);
      setCategories((cats.data as Category[]) ?? []);
      setProducts((prods.data as Product[]) ?? []);
      setSettings((st.data as StoreSettings) ?? null);
      setActiveCat(((cats.data as Category[]) ?? [])[0]?.id ?? null);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const list = map.get(p.category_id) ?? [];
      list.push(p);
      map.set(p.category_id, list);
    }
    return map;
  }, [products]);

  const itemCount = cart.items.reduce((a, i) => a + i.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <header className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-primary via-accent to-secondary" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="mb-3 bg-primary text-primary-foreground border-0">
                <Flame className="mr-1 h-3 w-3" /> {settings?.is_open ? "Aberto agora" : "Fechado"}
              </Badge>
              <h1 className="text-4xl sm:text-6xl font-display tracking-tight">
                {settings?.store_name ?? "Burger House"}
              </h1>
              <p className="mt-2 max-w-md text-sidebar-foreground/80">
                Smash burgers, batatas crocantes e cervejas geladas. Peça e retire, receba em casa ou na sua mesa.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-sidebar-foreground/80">
                {settings?.address && (
                  <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{settings.address}</span>
                )}
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Pronto em ~25min</span>
              </div>
            </div>
            <CartTrigger itemCount={itemCount} total={cartTotal(cart.items)} />
          </div>
        </div>
      </header>

      {/* CATEGORIES TABS */}
      <nav className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <ScrollArea className="w-full">
          <div className="mx-auto flex max-w-6xl gap-1 px-4 py-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  activeCat === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </ScrollArea>
      </nav>

      {/* PRODUCT LIST */}
      <main className="mx-auto max-w-6xl px-4 py-8 pb-32">
        {loading && <p className="text-muted-foreground">Carregando cardápio…</p>}
        {!loading && categories.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              Nenhuma categoria cadastrada. Rode <code className="rounded bg-muted px-1">docs/SUPABASE_MIGRATIONS.sql</code> no seu Supabase.
            </p>
          </div>
        )}
        {categories.map((cat) => (
          <section key={cat.id} id={`cat-${cat.id}`} className="mb-10 scroll-mt-20">
            <h2 className="mb-4 text-2xl font-display tracking-tight">{cat.name}</h2>
            {cat.description && <p className="mb-4 -mt-3 text-sm text-muted-foreground">{cat.description}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {(grouped.get(cat.id) ?? []).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* MOBILE FLOATING CART */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-card p-3 shadow-lg sm:hidden">
          <CartTrigger itemCount={itemCount} total={cartTotal(cart.items)} fullWidth />
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex gap-3 rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-card-foreground">{product.name}</h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-lg text-primary">{brl(Number(product.price))}</span>
          <Button size="sm" onClick={() => cartStore.add(product)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </div>
      <div className="aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">🍔</div>
        )}
      </div>
    </article>
  );
}

function CartTrigger({ itemCount, total, fullWidth }: { itemCount: number; total: number; fullWidth?: boolean }) {
  const cart = useCart();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="lg" className={cn("relative shadow-lg", fullWidth && "w-full")}>
          <ShoppingBag className="mr-2 h-5 w-5" />
          {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? "s" : ""} • ${brl(total)}` : "Meu pedido"}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Seu pedido</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {cart.items.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Carrinho vazio. Adicione itens do cardápio.</p>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((i) => (
                <li key={i.productId} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-sm text-muted-foreground">{brl(i.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => cartStore.setQty(i.productId, i.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => cartStore.setQty(i.productId, i.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => cartStore.remove(i.productId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {cart.items.length > 0 && (
          <SheetFooter className="border-t pt-4">
            <div className="flex w-full flex-col gap-3">
              <div className="flex items-center justify-between text-lg">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-display text-primary">{brl(cartTotal(cart.items))}</span>
              </div>
              <Button asChild size="lg">
                <Link to="/checkout">Finalizar pedido</Link>
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
