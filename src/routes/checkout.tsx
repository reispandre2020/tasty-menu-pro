import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Navigation,
  Grid3x3,
  Store,
  MapPin,
  Pencil,
  Clock,
  ChevronRight,
  Banknote,
  CreditCard,
  QrCode,
  ShoppingBag,
  Plus,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { OrderMode, StoreSettings } from "@/lib/menu-types";
import { brl, formatPhone } from "@/lib/format";
import { cartStore, cartTotal, useCart } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "Finalizar pedido" }] }),
});

type Step =
  | "identificacao"
  | "entrega"
  | "endereco"
  | "confirmar-entrega"
  | "pagamento"
  | "revisao";

interface AddressData {
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  endereco: string;
  numero: string;
  semNumero: boolean;
  complemento: string;
  semCompl: boolean;
  referencia: string;
}

const emptyAddress: AddressData = {
  cep: "",
  uf: "",
  cidade: "",
  bairro: "",
  endereco: "",
  numero: "",
  semNumero: false,
  complemento: "",
  semCompl: false,
  referencia: "",
};

function formatAddress(a: AddressData): string {
  const num = a.semNumero ? "S/N" : a.numero;
  const compl = a.semCompl || !a.complemento ? "" : `, ${a.complemento}`;
  return `${a.endereco}, ${num}${compl} - ${a.bairro}, ${a.cidade}/${a.uf} - CEP ${a.cep}${
    a.referencia ? ` (Ref: ${a.referencia})` : ""
  }`;
}

const SAVED_ADDRESS_KEY = "checkout-address-v1";
const SAVED_CONTACT_KEY = "checkout-contact-v1";

function CheckoutPage() {
  const cart = useCart();
  const nav = useNavigate();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [step, setStep] = useState<Step>("identificacao");
  const [submitting, setSubmitting] = useState(false);

  // dados do cliente
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  // entrega
  const [mode, setMode] = useState<OrderMode>("delivery");
  const [address, setAddress] = useState<AddressData>(emptyAddress);
  const [savedAddress, setSavedAddress] = useState<AddressData | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [pendingMapAddress, setPendingMapAddress] = useState<AddressData | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [quickCep, setQuickCep] = useState("");

  // pagamento
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [showChangeDialog, setShowChangeDialog] = useState(false);

  // revisão
  const [coupon, setCoupon] = useState("");
  const [cpf, setCpf] = useState("");
  const [linkCpf, setLinkCpf] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    supabase.from("store_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      setSettings(data as StoreSettings | null);
    });
    try {
      const sa = localStorage.getItem(SAVED_ADDRESS_KEY);
      if (sa) setSavedAddress(JSON.parse(sa));
      const sc = localStorage.getItem(SAVED_CONTACT_KEY);
      if (sc) {
        const c = JSON.parse(sc);
        setName(c.name ?? "");
        setPhone(c.phone ?? "");
      }
    } catch { /* ignore */ }
  }, []);

  const subtotal = cartTotal(cart.items);
  const deliveryFee = mode === "delivery" ? Number(settings?.delivery_fee ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const minOrder = Number(settings?.min_order_value ?? 0);
  const itemCount = useMemo(
    () => cart.items.reduce((acc, i) => acc + i.quantity, 0),
    [cart.items],
  );

  if (cart.items.length === 0 && !submitting) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-display">Carrinho vazio</h1>
        <p className="mt-2 text-muted-foreground">Volte ao cardápio para adicionar itens.</p>
        <Button asChild className="mt-6"><Link to="/">Ver cardápio</Link></Button>
      </div>
    );
  }

  // ---------- Navegação entre passos ----------
  function goBack() {
    const order: Step[] = ["identificacao", "entrega", "endereco", "confirmar-entrega", "pagamento", "revisao"];
    const idx = order.indexOf(step);
    if (idx <= 0) {
      nav({ to: "/" });
    } else if (step === "endereco") {
      setStep("entrega");
    } else if (step === "confirmar-entrega") {
      setStep("entrega");
    } else if (step === "pagamento") {
      setStep("confirmar-entrega");
    } else if (step === "revisao") {
      setStep("pagamento");
    } else {
      setStep(order[idx - 1]);
    }
  }

  // ---------- PASSO 1/2: Identificação ----------
  function submitIdent() {
    setShowValidation(true);
    if (name.trim().length < 3) return;
    if (phone.replace(/\D/g, "").length < 10) return;
    try {
      localStorage.setItem(SAVED_CONTACT_KEY, JSON.stringify({ name, phone }));
    } catch { /* ignore */ }
    setStep("entrega");
  }

  // ---------- PASSO 3/4: Opções de entrega ----------
  async function buscarCep(cepRaw: string, openForm = true) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) {
      toast.error("CEP inválido");
      return;
    }
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      const novo: AddressData = {
        ...emptyAddress,
        cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
        uf: j.uf ?? "",
        cidade: j.localidade ?? "",
        bairro: j.bairro ?? "",
        endereco: j.logradouro ?? "",
      };
      setAddress(novo);
      if (openForm) setStep("endereco");
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  function useCurrentLocation() {
    // Sem API real — vai direto para form de endereço com CEP da loja se houver
    setMode("delivery");
    setAddress(emptyAddress);
    setStep("endereco");
  }

  function selectSavedAddress() {
    if (!savedAddress) return;
    setMode("delivery");
    setAddress(savedAddress);
    // simular confirmação no mapa
    setPendingMapAddress(savedAddress);
    setShowMap(true);
  }

  function selectStorePickup() {
    setMode("pickup");
    setStep("pagamento");
  }

  // ---------- PASSO 5: Mapa ----------
  function confirmMap() {
    if (pendingMapAddress) {
      setAddress(pendingMapAddress);
      try {
        localStorage.setItem(SAVED_ADDRESS_KEY, JSON.stringify(pendingMapAddress));
        setSavedAddress(pendingMapAddress);
      } catch { /* ignore */ }
    }
    setShowMap(false);
    setStep("confirmar-entrega");
  }

  // ---------- PASSO 6: Form de endereço ----------
  function submitAddressForm() {
    if (!address.cep || !address.uf || !address.cidade || !address.bairro || !address.endereco) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (!address.semNumero && !address.numero.trim()) {
      toast.error("Informe o número ou marque 'Sem número'");
      return;
    }
    setPendingMapAddress(address);
    setShowMap(true);
  }

  // ---------- PASSO 8/9: Pagamento ----------
  function selectPayment(method: string) {
    setPaymentMethod(method);
    if (method === "cash") {
      setShowChangeDialog(true);
    } else {
      setNeedsChange(false);
      setChangeFor("");
      setStep("revisao");
    }
  }

  function confirmChange(needs: boolean) {
    setNeedsChange(needs);
    if (!needs) setChangeFor("");
    setShowChangeDialog(false);
    setStep("revisao");
  }

  // ---------- PASSO 10: Enviar pedido ----------
  async function sendOrder() {
    if (subtotal < minOrder) {
      toast.error(`Pedido mínimo de ${brl(minOrder)}`);
      return;
    }
    setSubmitting(true);

    const finalNotes = [
      notes.trim() || null,
      cpf.trim() ? `CPF: ${cpf.trim()}` : null,
      coupon.trim() ? `Cupom: ${coupon.trim()}` : null,
      paymentMethod === "cash" && needsChange && changeFor
        ? `Troco para ${brl(Number(changeFor.replace(/\D/g, "")) / 100)}`
        : paymentMethod === "cash" && !needsChange
          ? "Não precisa de troco"
          : null,
    ]
      .filter(Boolean)
      .join(" | ") || null;

    const customerAddr = mode === "delivery" ? formatAddress(address) : null;

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        mode,
        status: "pending",
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, ""),
        customer_address: customerAddr,
        table_number: null,
        notes: finalNotes,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_method: paymentMethod,
      })
      .select("id, short_code")
      .single();

    if (error || !order) {
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
      toast.error("Erro ao salvar itens.");
      setSubmitting(false);
      return;
    }

    cartStore.clear();
    nav({ to: "/pedido/$id", params: { id: order.id } });
  }

  const stepTitle: Record<Step, string> = {
    identificacao: "Identificação",
    entrega: "Opções de entrega",
    endereco: "Entregar no meu endereço",
    "confirmar-entrega": "Entregar no endereço",
    pagamento: "Selecione a forma de pagamento",
    revisao: "Confirmar pedido",
  };

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-background">
      {/* HEADER fixo da loja */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground">
            {(settings?.store_name ?? "L").charAt(0).toUpperCase()}
          </div>
          <span className="font-display text-lg">{settings?.store_name ?? "Loja"}</span>
        </div>
      </header>

      {/* Sub-header com seta voltar + título do passo */}
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-xl sm:text-2xl">{stepTitle[step]}</h1>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-24 lg:grid-cols-[1fr_360px]">
        {/* ============ COLUNA PRINCIPAL ============ */}
        <main className="space-y-4">
          {step === "identificacao" && (
            <IdentificationStep
              name={name}
              phone={phone}
              showValidation={showValidation}
              onName={setName}
              onPhone={setPhone}
              onSubmit={submitIdent}
            />
          )}

          {step === "entrega" && (
            <DeliveryOptionsStep
              savedAddress={savedAddress}
              quickCep={quickCep}
              cepLoading={cepLoading}
              onQuickCep={setQuickCep}
              onUseCurrent={useCurrentLocation}
              onSelectSaved={selectSavedAddress}
              onSearchCep={() => buscarCep(quickCep)}
              onPickup={selectStorePickup}
              storeName={settings?.store_name ?? "Loja"}
              storeAddress={settings?.address ?? ""}
            />
          )}

          {step === "endereco" && (
            <AddressFormStep
              address={address}
              cepLoading={cepLoading}
              onChange={setAddress}
              onSearchCep={(cep) => buscarCep(cep, false)}
              onConfirm={submitAddressForm}
            />
          )}

          {step === "confirmar-entrega" && (
            <ConfirmDeliveryStep
              address={address}
              fee={deliveryFee}
              onChangeAddress={() => setStep("entrega")}
              onContinue={() => setStep("pagamento")}
            />
          )}

          {step === "pagamento" && (
            <PaymentStep
              selected={paymentMethod}
              onSelect={selectPayment}
              onContinue={() => {
                if (!paymentMethod) {
                  toast.error("Selecione uma forma de pagamento");
                  return;
                }
                setStep("revisao");
              }}
            />
          )}

          {step === "revisao" && (
            <ReviewStep
              items={cart.items}
              mode={mode}
              address={address}
              paymentMethod={paymentMethod}
              needsChange={needsChange}
              changeFor={changeFor}
              coupon={coupon}
              cpf={cpf}
              notes={notes}
              onCoupon={setCoupon}
              onCpf={setCpf}
              linkCpf={linkCpf}
              onLinkCpf={setLinkCpf}
              onNotes={setNotes}
              onApplyCoupon={() => toast.error("Cupom inválido")}
              onEditCart={() => nav({ to: "/" })}
              onChangeAddress={() => setStep("entrega")}
              onChangePayment={() => setStep("pagamento")}
            />
          )}
        </main>

        {/* ============ RESUMO LATERAL ============ */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <SummaryCard
            itemCount={itemCount}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            total={total}
            mode={mode}
            showSendButton={step === "revisao"}
            submitting={submitting}
            onSend={sendOrder}
          />
        </aside>
      </div>

      {/* PASSO 5: Modal do mapa */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogTitle className="sr-only">Confirmar localização</DialogTitle>
          <MapConfirm
            address={pendingMapAddress}
            onAdjust={() => {
              setShowMap(false);
              setStep("endereco");
            }}
            onConfirm={confirmMap}
          />
        </DialogContent>
      </Dialog>

      {/* PASSO 9: Dialog do troco */}
      <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle>Preciso de troco para:</DialogTitle>
          <Input
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={changeFor ? brl(Number(changeFor.replace(/\D/g, "")) / 100) : ""}
            onChange={(e) => setChangeFor(e.target.value.replace(/\D/g, ""))}
            className="text-lg"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => confirmChange(false)}>
              NÃO PRECISO
            </Button>
            <Button className="flex-1" onClick={() => confirmChange(true)} disabled={!changeFor}>
              CONTINUAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===========================================================
   STEP COMPONENTS
=========================================================== */

function IdentificationStep(props: {
  name: string;
  phone: string;
  showValidation: boolean;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onSubmit: () => void;
}) {
  const nameError = props.showValidation && props.name.trim().length < 3;
  const phoneError = props.showValidation && props.phone.replace(/\D/g, "").length < 10;

  return (
    <section className="rounded-2xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-display text-lg">Dados para contato</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Precisamos do seu nome e número do WhatsApp. Entraremos em contato somente se precisar!
        </p>
      </div>

      <div>
        <Label htmlFor="name">Seu nome</Label>
        <Input
          id="name"
          value={props.name}
          onChange={(e) => props.onName(e.target.value.slice(0, 80))}
          placeholder="Ex.: Maria da Silva"
          maxLength={80}
        />
        {nameError && (
          <p className="mt-1 text-xs text-destructive">*O nome deve ter 3 ou mais caracteres!</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">WhatsApp / Telefone</Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">
            W
          </div>
          <Input
            id="phone"
            value={formatPhone(props.phone)}
            onChange={(e) => props.onPhone(e.target.value)}
            placeholder="(99) 99999-9999"
            className="pl-12"
          />
        </div>
        {phoneError && (
          <p className="mt-1 text-xs text-destructive">*Informe o número de telefone!</p>
        )}
      </div>

      <div className="flex justify-center pt-2">
        <Button onClick={props.onSubmit} size="lg" className="px-12">
          CONTINUAR
        </Button>
      </div>
    </section>
  );
}

function DeliveryOptionsStep(props: {
  savedAddress: AddressData | null;
  quickCep: string;
  cepLoading: boolean;
  storeName: string;
  storeAddress: string;
  onQuickCep: (v: string) => void;
  onUseCurrent: () => void;
  onSelectSaved: () => void;
  onSearchCep: () => void;
  onPickup: () => void;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 font-display text-lg">Entregar no meu endereço</h2>

        <button
          onClick={props.onUseCurrent}
          className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent/30 transition"
        >
          <Navigation className="h-6 w-6 text-primary shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Usar a minha localização atual</div>
            <div className="text-sm text-muted-foreground">Ativar localização automática</div>
          </div>
          <span className="text-sm text-primary font-medium flex items-center gap-1">
            Selecionar <ChevronRight className="h-4 w-4" />
          </span>
        </button>

        {props.savedAddress && (
          <button
            onClick={props.onSelectSaved}
            className="mt-2 flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent/30 transition"
          >
            <div className="flex-1">
              <div className="font-medium">
                {props.savedAddress.endereco}, {props.savedAddress.semNumero ? "S/N" : props.savedAddress.numero}
              </div>
              <div className="text-sm text-muted-foreground">
                {props.savedAddress.bairro}, {props.savedAddress.cidade} - {props.savedAddress.cep}
              </div>
            </div>
            <span className="text-sm text-primary font-medium flex items-center gap-1">
              Selecionar <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        )}

        <div className="mt-2 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Grid3x3 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Digitar meu endereço</div>
              <div className="text-sm text-muted-foreground">Informar meu endereço por CEP</div>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Digite o CEP"
                  value={props.quickCep}
                  onChange={(e) => props.onQuickCep(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={props.onSearchCep} disabled={props.cepLoading}>
                  {props.cepLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  BUSCAR CEP
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg">Ir até o estabelecimento</h2>
        <button
          onClick={props.onPickup}
          className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent/30 transition"
        >
          <Store className="h-10 w-10 text-primary shrink-0" />
          <div className="flex-1">
            <div className="font-bold uppercase">{props.storeName}</div>
            <div className="text-sm text-muted-foreground">{props.storeAddress || "Endereço da loja"}</div>
          </div>
          <span className="text-sm text-primary font-medium flex items-center gap-1">
            Selecionar <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      </section>
    </div>
  );
}

function AddressFormStep(props: {
  address: AddressData;
  cepLoading: boolean;
  onChange: (a: AddressData) => void;
  onSearchCep: (cep: string) => void;
  onConfirm: () => void;
}) {
  const a = props.address;
  const set = (patch: Partial<AddressData>) => props.onChange({ ...a, ...patch });

  return (
    <section className="space-y-4">
      <div>
        <Label>Novo CEP</Label>
        <div className="flex gap-2">
          <Input
            value={a.cep}
            onChange={(e) => set({ cep: e.target.value })}
            placeholder="00000-000"
          />
          <Button onClick={() => props.onSearchCep(a.cep)} disabled={props.cepLoading}>
            {props.cepLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            BUSCAR CEP
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div>
          <Label>UF</Label>
          <Input value={a.uf} onChange={(e) => set({ uf: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Select value={a.cidade || undefined} onValueChange={(v) => set({ cidade: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione sua cidade" />
            </SelectTrigger>
            <SelectContent>
              {a.cidade && <SelectItem value={a.cidade}>{a.cidade}</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Bairro</Label>
        <Input value={a.bairro} onChange={(e) => set({ bairro: e.target.value })} />
      </div>

      <div>
        <Label>Endereço</Label>
        <Input value={a.endereco} onChange={(e) => set({ endereco: e.target.value })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Número</Label>
          <div className="relative">
            <Input
              value={a.numero}
              onChange={(e) => set({ numero: e.target.value })}
              disabled={a.semNumero}
              inputMode="numeric"
            />
            <label className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs">
              <Checkbox checked={a.semNumero} onCheckedChange={(v) => set({ semNumero: v === true })} />
              Sem número
            </label>
          </div>
        </div>
        <div>
          <Label>Complemento</Label>
          <div className="relative">
            <Input
              value={a.complemento}
              onChange={(e) => set({ complemento: e.target.value })}
              disabled={a.semCompl}
            />
            <label className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs">
              <Checkbox checked={a.semCompl} onCheckedChange={(v) => set({ semCompl: v === true })} />
              Sem compl.
            </label>
          </div>
        </div>
      </div>

      <div>
        <Label>Ponto de Referência (Opcional)</Label>
        <Textarea value={a.referencia} onChange={(e) => set({ referencia: e.target.value })} rows={2} />
      </div>

      <div className="flex justify-center pt-2">
        <Button onClick={props.onConfirm} size="lg" className="px-16">
          CONFIRMAR
        </Button>
      </div>
    </section>
  );
}

function MapConfirm(props: {
  address: AddressData | null;
  onAdjust: () => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <div className="relative h-72 bg-[repeating-linear-gradient(45deg,hsl(var(--muted))_0_10px,hsl(var(--background))_10px_20px)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <MapPin className="h-12 w-12 text-blue-500 drop-shadow-lg" fill="currentColor" />
        </div>
        <div className="absolute left-3 right-3 top-3 rounded-xl bg-background/95 p-3 shadow">
          <div className="font-bold">A localização está correta?</div>
          <div className="text-sm text-muted-foreground">
            {props.address?.endereco}, {props.address?.cep}
          </div>
        </div>
      </div>
      <div className="flex gap-2 p-4">
        <Button variant="outline" className="flex-1" onClick={props.onAdjust}>
          AJUSTAR
        </Button>
        <Button className="flex-1" onClick={props.onConfirm}>
          CONFIRMAR
        </Button>
      </div>
    </div>
  );
}

function ConfirmDeliveryStep(props: {
  address: AddressData;
  fee: number;
  onChangeAddress: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <div className="flex gap-3">
          <MapPin className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <div className="font-medium">
              {props.address.endereco}, {props.address.semNumero ? "S/N" : props.address.numero}
            </div>
            <div className="text-sm text-muted-foreground">
              {props.address.bairro}<br />
              {props.address.cidade} - CEP {props.address.cep}
            </div>
            {props.address.complemento && !props.address.semCompl && (
              <div className="text-sm italic mt-1">{props.address.complemento}</div>
            )}
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="font-medium">Taxa de entrega</div>
          <div className="text-sm text-muted-foreground">
            {props.fee > 0 ? brl(props.fee) : "GRÁTIS"}
          </div>
        </div>

        <button
          onClick={props.onChangeAddress}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" /> Alterar entrega ou endereço
        </button>
      </div>

      <div className="rounded-2xl border-2 border-primary bg-card p-4 flex items-center gap-3">
        <Clock className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="font-medium">Agora (50-60min)</div>
        </div>
        <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary" />
      </div>

      <div className="flex justify-center pt-2">
        <Button onClick={props.onContinue} size="lg" className="px-12">
          CONTINUAR
        </Button>
      </div>
    </section>
  );
}

function PaymentStep(props: {
  selected: string;
  onSelect: (m: string) => void;
  onContinue: () => void;
}) {
  const opts = [
    { id: "cash", label: "Dinheiro", icon: Banknote, color: "text-green-500" },
    { id: "credit", label: "Cartão de Crédito", icon: CreditCard, color: "text-blue-500" },
    { id: "debit", label: "Cartão de Débito", icon: CreditCard, color: "text-orange-500" },
    { id: "pix", label: "Pix Manual", icon: QrCode, color: "text-teal-500" },
  ];
  return (
    <section className="space-y-2">
      <div className="border-b-2 border-primary pb-2">
        <span className="font-medium">Pague na entrega</span>
      </div>
      {opts.map((o) => {
        const Icon = o.icon;
        const sel = props.selected === o.id;
        return (
          <button
            key={o.id}
            onClick={() => props.onSelect(o.id)}
            className="flex w-full items-center gap-3 border-b py-4 text-left hover:bg-accent/20 transition px-2"
          >
            <Icon className={`h-6 w-6 ${o.color}`} />
            <span className="flex-1 font-medium">{o.label}</span>
            <div className={`h-5 w-5 rounded-full border-2 ${sel ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
          </button>
        );
      })}
      <div className="flex justify-center pt-6">
        <Button onClick={props.onContinue} size="lg" className="px-16">
          CONTINUAR
        </Button>
      </div>
    </section>
  );
}

function ReviewStep(props: {
  items: ReturnType<typeof useCart>["items"];
  mode: OrderMode;
  address: AddressData;
  paymentMethod: string;
  needsChange: boolean;
  changeFor: string;
  coupon: string;
  cpf: string;
  notes: string;
  onCoupon: (v: string) => void;
  onCpf: (v: string) => void;
  linkCpf: boolean;
  onLinkCpf: (v: boolean) => void;
  onNotes: (v: string) => void;
  onApplyCoupon: () => void;
  onEditCart: () => void;
  onChangeAddress: () => void;
  onChangePayment: () => void;
}) {
  const payLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    cash: { label: "Dinheiro", icon: Banknote, color: "text-green-500" },
    credit: { label: "Cartão de Crédito", icon: CreditCard, color: "text-blue-500" },
    debit: { label: "Cartão de Débito", icon: CreditCard, color: "text-orange-500" },
    pix: { label: "Pix Manual", icon: QrCode, color: "text-teal-500" },
  };
  const pay = payLabels[props.paymentMethod];
  const PayIcon = pay?.icon ?? Wallet;

  return (
    <section className="space-y-5">
      {/* Sacola */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-medium">
            <ShoppingBag className="h-5 w-5" /> Minha Sacola ({props.items.length})
          </div>
          <button onClick={props.onEditCart} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Ver e Editar
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {props.items.map((i) => (
            <li key={i.productId} className="flex justify-between">
              <span>{i.quantity}x {i.name}</span>
              <span>{brl(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <button onClick={props.onEditCart} className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline">
          <Plus className="h-3.5 w-3.5" /> Adicionar mais itens
        </button>
      </div>

      {/* Endereço */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-medium">
            <MapPin className="h-5 w-5" />
            {props.mode === "delivery" ? "Entregar no endereço" : "Retirada no balcão"}
          </div>
          {props.mode === "delivery" && (
            <button onClick={props.onChangeAddress} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Pencil className="h-3.5 w-3.5" /> Trocar
            </button>
          )}
        </div>
        {props.mode === "delivery" && (
          <div className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Agora (50-60min)</div>
            <div>{props.address.endereco}, {props.address.semNumero ? "S/N" : props.address.numero}</div>
            <div>{props.address.bairro}</div>
            <div>{props.address.cidade} - CEP {props.address.cep}</div>
            {props.address.complemento && !props.address.semCompl && <div className="italic">{props.address.complemento}</div>}
          </div>
        )}
      </div>

      {/* Pagamento */}
      <div className="border-b pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-medium">
            <Wallet className="h-5 w-5" /> Pagamento
          </div>
          <button onClick={props.onChangePayment} className="flex items-center gap-1 text-sm text-primary hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Trocar
          </button>
        </div>
        {pay && (
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase">Pagar na entrega</div>
            <div className="flex items-center gap-2 mt-1">
              <PayIcon className={`h-5 w-5 ${pay.color}`} />
              <div>
                <div className="font-medium">{pay.label}</div>
                {props.paymentMethod === "cash" && props.needsChange && props.changeFor && (
                  <div className="text-sm text-muted-foreground">
                    Troco para: {brl(Number(props.changeFor.replace(/\D/g, "")) / 100)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cupom */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-2">
          <Input
            placeholder="Código do cupom"
            value={props.coupon}
            onChange={(e) => props.onCoupon(e.target.value)}
          />
          <Button variant="outline" onClick={props.onApplyCoupon}>APLICAR</Button>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="CPF / CNPJ"
            value={props.cpf}
            onChange={(e) => props.onCpf(e.target.value)}
            className="flex-1"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap cursor-pointer">
            <Checkbox
              checked={props.linkCpf}
              onCheckedChange={(v) => props.onLinkCpf(Boolean(v))}
            />
            Vincular ao cadastro
          </label>
        </div>
      </div>

      <div>
        <Textarea
          placeholder="Observação"
          value={props.notes}
          onChange={(e) => props.onNotes(e.target.value.slice(0, 300))}
          rows={3}
        />
      </div>
    </section>
  );
}

function SummaryCard(props: {
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  mode: OrderMode;
  showSendButton: boolean;
  submitting: boolean;
  onSend: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-card p-5">
      <h3 className="font-display text-lg mb-3">Resumo</h3>
      <div className="border-t border-muted-foreground/20" />
      <div className="space-y-2 pt-3 text-sm">
        <div className="flex justify-between">
          <span>{props.itemCount} {props.itemCount === 1 ? "item" : "itens"}</span>
          <span>{brl(props.subtotal)}</span>
        </div>
        {props.mode === "delivery" && (
          <div className="flex justify-between">
            <span>Taxa de entrega</span>
            <span className={props.deliveryFee === 0 ? "font-bold text-primary" : ""}>
              {props.deliveryFee > 0 ? brl(props.deliveryFee) : "GRÁTIS"}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 border-t border-muted-foreground/20 pt-3 flex justify-between font-display text-lg">
        <span>Total</span>
        <span>{brl(props.total)}</span>
      </div>

      {props.showSendButton && (
        <Button
          onClick={props.onSend}
          disabled={props.submitting}
          size="lg"
          className="w-full mt-4"
        >
          {props.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          ENVIAR PEDIDO
        </Button>
      )}
    </div>
  );
}
