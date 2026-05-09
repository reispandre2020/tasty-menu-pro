import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, Plus, Minus, Trash2, Clock, MapPin, Search, Phone, Menu as MenuIcon, MoreVertical, LogIn, UtensilsCrossed, Percent, Info, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Product, StoreSettings } from "@/lib/menu-types";
import { brl } from "@/lib/format";
import { cartStore, cartTotal, useCart } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
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
  const [query, setQuery] = useState("");
  const cart = useCart();
  const tabsRef = useRef<HTMLDivElement>(null);

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

  // Observer para destacar a categoria visível na tab bar
  useEffect(() => {
    if (loading || categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = visible.target.id.replace("cat-", "");
          setActiveCat(id);
        }
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading, categories]);

  // Mantém o botão da categoria ativa visível na tab bar com scroll horizontal
  useEffect(() => {
    if (!activeCat || !tabsRef.current) return;
    const btn = tabsRef.current.querySelector<HTMLElement>(`[data-cat-id="${activeCat}"]`);
    if (btn) {
      const left = btn.offsetLeft - tabsRef.current.clientWidth / 2 + btn.clientWidth / 2;
      tabsRef.current.scrollTo({ left, behavior: "smooth" });
    }
  }, [activeCat]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Product[]>();
    for (const p of products) {
      if (q && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(q)) continue;
      const list = map.get(p.category_id) ?? [];
      list.push(p);
      map.set(p.category_id, list);
    }
    return map;
  }, [products, query]);

  const itemCount = cart.items.reduce((a, i) => a + i.quantity, 0);
  const storeName = settings?.store_name ?? "Burger House";
  const initial = storeName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* COVER */}
      <header className="relative">
        <div className="relative h-44 sm:h-56 overflow-hidden bg-sidebar">
          <div
            aria-hidden
            className="absolute inset-0 opacity-90"
            style={{
              backgroundImage:
                "radial-gradient(120% 80% at 20% 0%, color-mix(in oklab, var(--primary) 60%, transparent), transparent 60%), radial-gradient(80% 80% at 90% 100%, color-mix(in oklab, var(--accent) 60%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in oklab, var(--sidebar) 75%, black) 0%, var(--sidebar) 100%)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.06)_1px,_transparent_0)] [background-size:18px_18px]" />
          {/* HAMBURGER MENU */}
          <div className="absolute left-3 top-3 z-10">
            <SideMenu storeName={storeName} initial={initial} />
          </div>
        </div>

        {/* Logo + nome flutuando sobre o cover */}
        <div className="relative -mt-12 sm:-mt-14 px-4">
          <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
            <div className="grid h-24 w-24 sm:h-28 sm:w-28 place-items-center rounded-full border-4 border-background bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-xl">
              <span className="font-display text-4xl sm:text-5xl leading-none">{initial}</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-display tracking-tight">{storeName}</h1>
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold",
                settings?.is_open
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", settings?.is_open ? "bg-success" : "bg-destructive")} />
              {settings?.is_open ? "Aberto" : "Fechado"}
            </span>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {settings?.address && (
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{settings.address}</span>
              )}
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />~25min</span>
              {settings?.phone && (
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{settings.phone}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* SEARCH */}
      <div className="mx-auto mt-6 max-w-3xl px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no cardápio…"
            className="h-11 rounded-full border-border bg-card pl-10"
          />
        </div>
      </div>

      {/* CATEGORIES TABS — sticky, underline style */}
      <nav className="sticky top-0 z-30 mt-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center px-2">
          <CategoriesDialog
            categories={categories}
            onSelect={(id) => {
              setActiveCat(id);
              document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          <div
            ref={tabsRef}
            className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {categories.map((c) => {
              const isActive = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  data-cat-id={c.id}
                  onClick={() => {
                    setActiveCat(c.id);
                    document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.name}
                  <span
                    className={cn(
                      "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all",
                      isActive ? "bg-primary scale-x-100" : "bg-transparent scale-x-0",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* PRODUCT LIST */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-5 w-20 rounded bg-muted" />
                </div>
                <div className="h-24 w-24 rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        )}
        {!loading && categories.length === 0 && (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              Nenhuma categoria cadastrada. Rode <code className="rounded bg-muted px-1">docs/SUPABASE_MIGRATIONS.sql</code> no seu Supabase.
            </p>
          </div>
        )}
        {!loading && categories.map((cat) => {
          const items = grouped.get(cat.id) ?? [];
          if (query && items.length === 0) return null;
          return (
            <section key={cat.id} id={`cat-${cat.id}`} className="mb-8 scroll-mt-16">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-xl font-display tracking-tight">{cat.name}</h2>
                <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "item" : "itens"}</span>
              </div>
              {cat.description && <p className="mb-3 -mt-2 text-sm text-muted-foreground">{cat.description}</p>}
              <div className="flex flex-col gap-2">
                {items.map((p) => <ProductCard key={p.id} product={p} />)}
                {items.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Em breve novos itens nesta categoria.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </main>

      {/* FLOATING CART — sempre visível quando há itens */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 p-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)] backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <CartTrigger itemCount={itemCount} total={cartTotal(cart.items)} fullWidth />
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const inCart = useCart().items.find((i) => i.productId === product.id)?.quantity ?? 0;
  return (
    <article className="group flex gap-3 rounded-2xl border border-border bg-card p-3 transition-shadow hover:shadow-md">
      <div className="flex flex-1 min-w-0 flex-col">
        <h3 className="font-semibold text-card-foreground leading-tight">{product.name}</h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="font-display text-lg text-primary">{brl(Number(product.price))}</span>
          {inCart > 0 ? (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => cartStore.setQty(product.id, inCart - 1)} aria-label="Remover um">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center text-sm font-semibold">{inCart}</span>
              <Button size="icon" className="h-8 w-8 rounded-full" onClick={() => cartStore.add(product)} aria-label="Adicionar mais um">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" className="rounded-full" onClick={() => cartStore.add(product)}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          )}
        </div>
      </div>
      <div className="relative aspect-square h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-muted">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
        <Button size="lg" className={cn("relative shadow-lg rounded-full", fullWidth && "w-full")}>
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

function SideMenu({ storeName, initial }: { storeName: string; initial: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-background/20 text-white hover:bg-background/30 backdrop-blur" aria-label="Abrir menu">
          <MenuIcon className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-display">
            {initial}
          </div>
          <SheetTitle className="text-base font-semibold truncate">{storeName}</SheetTitle>
        </div>
        <nav className="flex flex-col py-2">
          <Link to="/entrar" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted">
            <LogIn className="h-5 w-5 text-primary" /> Entrar
          </Link>
          <Link to="/" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted">
            <UtensilsCrossed className="h-5 w-5 text-primary" /> Cardápio
          </Link>
          <Link to="/cupons" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted">
            <Percent className="h-5 w-5 text-primary" /> Cupons de Desconto
          </Link>
          <Link to="/sobre" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted">
            <Info className="h-5 w-5 text-primary" /> Sobre Nós
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function CategoriesDialog({ categories, onSelect }: { categories: Category[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" aria-label="Ver todas categorias">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle className="text-center tracking-[0.3em] text-sm">— MENU —</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelect(c.id);
                setOpen(false);
              }}
              className="block w-full px-4 py-3 text-center text-sm font-medium uppercase tracking-wide hover:bg-muted"
            >
              {c.name}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
