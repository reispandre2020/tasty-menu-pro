import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cupons")({
  component: CuponsPage,
  head: () => ({ meta: [{ title: "Cupons de desconto" }] }),
});

function CuponsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border p-4">
        <Button asChild size="icon" variant="ghost" className="rounded-full bg-primary/15">
          <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-lg font-semibold">Cupons de desconto</h1>
      </header>
      <main className="grid place-items-center px-4 py-24 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-2xl border border-border">
          <Percent className="h-10 w-10 text-muted-foreground" />
        </div>
        <p className="mt-6 text-muted-foreground">Nenhum cupom encontrado para este estabelecimento.</p>
      </main>
    </div>
  );
}
