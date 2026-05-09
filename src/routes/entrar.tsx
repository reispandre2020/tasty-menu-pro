import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/entrar")({
  component: EntrarPage,
  head: () => ({ meta: [{ title: "Entrar" }] }),
});

function EntrarPage() {
  const [contact, setContact] = useState("");
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <Button asChild size="icon" variant="ghost" className="rounded-full bg-primary/15">
          <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-lg font-semibold">Entrar</h1>
      </header>
      <main className="mx-auto max-w-md px-4 py-10">
        <label className="text-sm font-medium">E-mail ou Telefone</label>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} className="mt-2 h-12" />
        <Button className="mt-4 h-12 w-full text-base font-bold tracking-wider">CONTINUAR</Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OU <div className="h-px flex-1 bg-border" />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com os nossos Termos de uso e políticas de privacidade.
        </p>
      </main>
    </div>
  );
}
