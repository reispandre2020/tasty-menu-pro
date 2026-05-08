import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { OrderMode, StoreSettings } from "@/lib/menu-types";
import { MODE_LABEL } from "@/lib/menu-types";
import { brl, formatPhone } from "@/lib/format";
import { cartStore, cartTotal, useCart } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Finalizar pedido" }] }),
});

function CheckoutPage() {
  const cart = useCart();
  const nav = useNavigate();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<OrderMode>("pickup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");

  useEffect(() => {
    supabase.from("store_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      setSettings(data as StoreSettings | null);
    });
  }, []);

  const subtotal = cartTotal(cart.items);
  const deliveryFee = mode === "delivery" ? Number(settings?.delivery_fee ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const minOrder = Number(settings?.min_order_value ?? 0);

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-display">Carrinho vazio</h1>
        <p className="mt-2 text-muted-foreground">Volte ao cardápio para adicionar itens.</p>
        <Button asChild className="mt-6"><Link to="/">Ver cardápio</Link></Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (subtotal < minOrder) {
      toast.error(`Pedido mínimo de ${brl(minOrder)}`);
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      toast.error("Preencha nome e telefone válido");
      return;
    }
    if (mode === "delivery" && !address.trim()) {
      toast.error("Informe o endereço de entrega");
      return;
    }
    if (mode === "dine_in" && !tableNumber.trim()) {
      toast.error("Informe o número da mesa");
      return;
    }
    setSubmitting(true);

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        mode,
        status: "pending",
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, ""),
        customer_address: mode === "delivery" ? address.trim() : null,
        table_number: mode === "dine_in" ? tableNumber.trim() : null,
        notes: notes.trim() || null,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_method: paymentMethod,
      })
      .select("id, short_code")
      .single();

    if (error || !order) {
      console.error(error);
      toast.error("Erro ao criar pedido. Tente novamente.");
      setSubmitting(false);
      return;
    }

    const items = cart.items.map((i) => ({
      order_id: order.id,
      product_id: i.productId,
      product_name: i.name,
      unit_price: i.price,
      quantity: i.quantity,
      notes: i.notes ?? null,
      subtotal: i.price * i.quantity,
    }));
    const { error: itErr } = await supabase.from("order_items").insert(items);
    if (itErr) {
      console.error(itErr);
      toast.error("Erro ao salvar itens.");
      setSubmitting(false);
      return;
    }

    cartStore.clear();
    nav({ to: "/pedido/$id", params: { id: order.id } });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Button asChild variant="ghost" size="icon"><Link to="/"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <h1 className="text-xl font-display">Finalizar pedido</h1>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {/* MODE */}
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg">Como você quer receber?</h2>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as OrderMode)} className="grid gap-2 sm:grid-cols-3">
            {(["pickup", "delivery", "dine_in"] as OrderMode[]).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-accent/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <RadioGroupItem value={m} />
                <span className="text-sm font-medium">{MODE_LABEL[m]}</span>
              </label>
            ))}
          </RadioGroup>
        </section>

        {/* CUSTOMER */}
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="font-display text-lg">Seus dados</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} required maxLength={80} />
            </div>
            <div>
              <Label htmlFor="phone">Telefone (WhatsApp)</Label>
              <Input id="phone" value={formatPhone(phone)} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" required />
            </div>
          </div>
          {mode === "delivery" && (
            <div>
              <Label htmlFor="addr">Endereço completo</Label>
              <Textarea id="addr" value={address} onChange={(e) => setAddress(e.target.value.slice(0, 200))} placeholder="Rua, número, bairro, complemento" required />
            </div>
          )}
          {mode === "dine_in" && (
            <div>
              <Label htmlFor="table">Número da mesa</Label>
              <Input id="table" value={tableNumber} onChange={(e) => setTableNumber(e.target.value.slice(0, 10))} required />
            </div>
          )}
          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 300))} placeholder="Sem cebola, ponto da carne, etc." />
          </div>
        </section>

        {/* PAYMENT */}
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg">Pagamento</h2>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid gap-2 sm:grid-cols-3">
            {[
              { v: "pix", l: "PIX" },
              { v: "card_on_delivery", l: "Cartão na entrega" },
              { v: "cash", l: "Dinheiro" },
            ].map((o) => (
              <label key={o.v} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-accent/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <RadioGroupItem value={o.v} />
                <span className="text-sm font-medium">{o.l}</span>
              </label>
            ))}
          </RadioGroup>
        </section>

        {/* SUMMARY */}
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-display text-lg">Resumo</h2>
          <ul className="divide-y text-sm">
            {cart.items.map((i) => (
              <li key={i.productId} className="flex justify-between py-2">
                <span>{i.quantity}× {i.name}</span>
                <span>{brl(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            {mode === "delivery" && <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span>{brl(deliveryFee)}</span></div>}
            <div className="flex justify-between text-lg font-display text-primary"><span>Total</span><span>{brl(total)}</span></div>
          </div>
        </section>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmar pedido • {brl(total)}
        </Button>
      </form>
    </div>
  );
}
