import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { StoreSettings } from "@/lib/menu-types";

export const Route = createFileRoute("/sobre")({
  component: SobrePage,
  head: () => ({ meta: [{ title: "Sobre Nós" }] }),
});

function SobrePage() {
  const [s, setS] = useState<StoreSettings | null>(null);
  useEffect(() => {
    supabase.from("store_settings").select("*").limit(1).maybeSingle().then(({ data }) => setS(data as StoreSettings));
  }, []);
  const initial = (s?.store_name ?? "L").charAt(0).toUpperCase();
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <Button asChild size="icon" variant="ghost" className="rounded-full bg-primary/15">
          <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-lg font-semibold">{s?.store_name ?? "Sobre Nós"}</h1>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative h-40 bg-gradient-to-br from-primary/40 to-accent/40">
            <div className="absolute -bottom-10 left-1/2 grid h-20 w-20 -translate-x-1/2 place-items-center rounded-full border-4 border-card bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-display text-2xl">
              {initial}
            </div>
          </div>
          <div className="px-4 pb-6 pt-12 text-center">
            <h2 className="font-display text-xl">{s?.store_name ?? "Loja"}</h2>
          </div>
          <div className="space-y-4 border-t border-border p-4 text-sm">
            <Section title="Opções de entrega">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Pill>Delivery</Pill>
                <Pill>Retirada</Pill>
                <Pill>Consumo no Local</Pill>
              </div>
            </Section>
            <Section title="Horário de funcionamento">
              <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                {s?.is_open ? "Aberto Agora" : "Fechado"}
              </span>
            </Section>
            {s?.address && (
              <Section title="Endereço"><p className="text-muted-foreground">{s.address}</p></Section>
            )}
            {s?.phone && (
              <Section title="Telefone"><p className="text-muted-foreground">{s.phone}</p></Section>
            )}
            <Section title="Formas de Pagamento">
              <div className="flex flex-wrap gap-2 text-xs">
                <Pill>Dinheiro</Pill><Pill>Crédito</Pill><Pill>Débito</Pill><Pill>Pix</Pill>
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-border px-2 py-1 text-center">{children}</span>;
}
