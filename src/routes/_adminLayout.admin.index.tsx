import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderStatus } from "@/lib/menu-types";
import { STATUS_LABEL, MODE_LABEL } from "@/lib/menu-types";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Phone, MapPin, Hash } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_adminLayout/admin/")({
  component: OrdersBoard,
  head: () => ({ meta: [{ title: "Admin — Pedidos" }] }),
});

const COLUMNS: { status: OrderStatus; tone: string }[] = [
  { status: "pending", tone: "bg-warning/15 border-warning" },
  { status: "confirmed", tone: "bg-accent/15 border-accent" },
  { status: "preparing", tone: "bg-primary/10 border-primary" },
  { status: "ready", tone: "bg-success/15 border-success" },
  { status: "out_for_delivery", tone: "bg-secondary/30 border-secondary" },
  { status: "delivered", tone: "bg-muted border-border" },
];

const NEXT_OPTIONS: OrderStatus[] = [
  "pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled",
];

function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar pedidos: " + error.message);
    }
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("orders-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const interval = setInterval(load, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  async function setStatus(id: string, status: OrderStatus) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Status: ${STATUS_LABEL[status]}`);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Pedidos de hoje</h1>
          <p className="text-sm text-muted-foreground">{orders.length} pedido(s) nas últimas 24h</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className={`rounded-2xl border-2 p-3 ${col.tone}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-sm uppercase tracking-wide">{STATUS_LABEL[col.status]}</h2>
                <Badge variant="secondary">{list.length}</Badge>
              </div>
              <div className="space-y-3">
                {list.map((o) => (
                  <OrderCard key={o.id} order={o} onChange={setStatus} />
                ))}
                {list.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Vazio</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ order, onChange }: { order: Order; onChange: (id: string, s: OrderStatus) => void }) {
  return (
    <article className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <Badge variant="outline">#{order.short_code}</Badge>
        <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <p className="mt-2 font-medium">{order.customer_name}</p>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customer_phone}</p>
        <p>{MODE_LABEL[order.mode]}</p>
        {order.customer_address && <p className="flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 shrink-0" />{order.customer_address}</p>}
        {order.table_number && <p className="flex items-center gap-1"><Hash className="h-3 w-3" />Mesa {order.table_number}</p>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-primary">{brl(Number(order.total))}</span>
        <Select value={order.status} onValueChange={(v) => onChange(order.id, v as OrderStatus)}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {NEXT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </article>
  );
}
