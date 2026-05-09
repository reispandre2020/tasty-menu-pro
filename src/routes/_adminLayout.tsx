import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutGrid, Package, FolderTree, Settings, LogOut, UtensilsCrossed, Loader2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_adminLayout")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Pedidos", icon: LayoutGrid },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/categorias", label: "Categorias", icon: FolderTree },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AdminLayout() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [storeName, setStoreName] = useState("Painel");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        nav({ to: "/admin/login" });
        return;
      }
      // checa role admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id);
      const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) {
        await supabase.auth.signOut();
        nav({ to: "/admin/login", search: { error: "no-role" } as never });
        return;
      }
      const { data: st } = await supabase.from("store_settings").select("store_name").limit(1).maybeSingle();
      if (st?.store_name) setStoreName(st.store_name);
      setReady(true);
      const sub = supabase.auth.onAuthStateChange((_e, session) => {
        if (!session) nav({ to: "/admin/login" });
      });
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => unsub?.();
  }, [nav]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/admin/login" });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <span className="font-display text-lg">{storeName}</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2"><UtensilsCrossed className="h-5 w-5 text-primary" /><span className="font-display">{storeName}</span></div>
          <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-4 w-4" /></Button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 md:hidden">
          {NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <Link key={n.to} to={n.to} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-sm", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
