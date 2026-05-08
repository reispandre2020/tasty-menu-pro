import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StoreSettings } from "@/lib/menu-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_adminLayout/admin/configuracoes")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Admin — Configurações" }] }),
});

function SettingsPage() {
  const [s, setS] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("store_settings").select("*").limit(1).maybeSingle().then(({ data }) => setS(data as StoreSettings));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase.from("store_settings").update({
      store_name: s.store_name,
      phone: s.phone,
      address: s.address,
      delivery_fee: Number(s.delivery_fee),
      min_order_value: Number(s.min_order_value),
      is_open: s.is_open,
      consumer_merchant_id: s.consumer_merchant_id,
    }).eq("id", s.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Configurações salvas");
  }

  if (!s) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-3xl">Configurações</h1>

      <div className="space-y-6">
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-display text-lg">Loja</h2>
          <div><Label>Nome da loja</Label><Input value={s.store_name} onChange={(e) => setS({ ...s, store_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={s.phone ?? ""} onChange={(e) => setS({ ...s, phone: e.target.value })} /></div>
            <div className="flex items-end justify-between rounded-lg border p-3"><Label>Aberta agora</Label><Switch checked={s.is_open} onCheckedChange={(v) => setS({ ...s, is_open: v })} /></div>
          </div>
          <div><Label>Endereço</Label><Input value={s.address ?? ""} onChange={(e) => setS({ ...s, address: e.target.value })} /></div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-display text-lg">Pedidos</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Taxa de entrega (R$)</Label><Input type="number" step="0.01" value={s.delivery_fee} onChange={(e) => setS({ ...s, delivery_fee: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Pedido mínimo (R$)</Label><Input type="number" step="0.01" value={s.min_order_value} onChange={(e) => setS({ ...s, min_order_value: parseFloat(e.target.value) || 0 })} /></div>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-display text-lg">Programa Consumer</h2>
          <p className="text-sm text-muted-foreground">
            Cole o <strong>merchant ID</strong> fornecido pelo painel do Consumer. O <strong>token de API</strong> é configurado como secret <code className="rounded bg-muted px-1">CONSUMER_API_TOKEN</code> no projeto.
          </p>
          <div><Label>Merchant ID</Label><Input value={s.consumer_merchant_id ?? ""} onChange={(e) => setS({ ...s, consumer_merchant_id: e.target.value })} placeholder="ex: 123456" /></div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Endpoints expostos para o Consumer:</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              <li>GET /api/consumer/menu</li>
              <li>GET /api/consumer/orders?status=pending</li>
              <li>GET /api/consumer/orders/:id</li>
              <li>PATCH /api/consumer/orders/:id/status</li>
            </ul>
          </div>
        </section>

        <Button onClick={save} disabled={saving} size="lg">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
