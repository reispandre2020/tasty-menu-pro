import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderItem } from "@/lib/menu-types";
import { STATUS_LABEL, MODE_LABEL } from "@/lib/menu-types";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/pedido/$id")({
  component: OrderPage,
  head: () => ({ meta: [{ title: "Acompanhar pedido" }] }),
});

function OrderPage() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      // Pedidos têm RLS de leitura só admin; usamos a rota pública /api/public para o cliente acompanhar.
      const res = await fetch(`/api/public/orders/${id}`);
      if (!res.ok) {
        if (mounted) setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!mounted) return;
      setOrder(data.order);
      setItems(data.items);
    }
    load();
    const interval = setInterval(load, 8000);
    // realtime subscribe (status updates)
    const channel = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-display">Pedido não encontrado</h1>
        <Button asChild className="mt-6"><Link to="/">Voltar ao cardápio</Link></Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const steps = ["pending", "confirmed", "preparing", "ready", order.mode === "delivery" ? "out_for_delivery" : "delivered"] as const;
  const activeIdx = steps.findIndex((s) => s === order.status);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-2xl px-4 py-6 text-center">
          <Badge className="mb-2">#{order.short_code}</Badge>
          <h1 className="text-3xl font-display">{STATUS_LABEL[order.status]}</h1>
          <p className="text-sm text-muted-foreground">{MODE_LABEL[order.mode]} • {order.customer_name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4">
        {/* Timeline */}
        <section className="rounded-2xl border bg-card p-5">
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const done = i <= activeIdx;
              return (
                <li key={s} className="flex items-center gap-3">
                  {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  <span className={done ? "font-medium" : "text-muted-foreground"}>{STATUS_LABEL[s]}</span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Items */}
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg">Itens</h2>
          <ul className="divide-y text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between py-2">
                <span>{i.quantity}× {i.product_name}</span>
                <span>{brl(Number(i.subtotal))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{brl(Number(order.subtotal))}</span></div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span>{brl(Number(order.delivery_fee))}</span></div>
            )}
            <div className="flex justify-between text-lg font-display text-primary"><span>Total</span><span>{brl(Number(order.total))}</span></div>
          </div>
        </section>

        {order.notes && (
          <section className="rounded-2xl border bg-card p-5 text-sm">
            <h3 className="mb-1 font-medium">Observações</h3>
            <p className="text-muted-foreground">{order.notes}</p>
          </section>
        )}

        <Button asChild variant="outline" className="w-full"><Link to="/">Fazer outro pedido</Link></Button>
      </main>
    </div>
  );
}
