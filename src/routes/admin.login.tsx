import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
  head: () => ({ meta: [{ title: "Admin — Login" }] }),
});

function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/admin" });
    });
  }, [nav]);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Bem-vindo!");
      nav({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin` : undefined },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      toast.success("Conta criada. Adicione a role 'admin' no SQL — veja docs/SETUP.md");
      setMode("login");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-2xl border border-sidebar-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2 text-primary">
          <UtensilsCrossed className="h-6 w-6" />
          <h1 className="font-display text-2xl">Painel Admin</h1>
        </div>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="pwd">Senha</Label>
            <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
            className="w-full text-center text-sm text-muted-foreground hover:text-primary"
          >
            {mode === "login" ? "Criar nova conta" : "Já tenho conta"}
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">← voltar ao cardápio</Link>
        </div>
      </div>
    </div>
  );
}
