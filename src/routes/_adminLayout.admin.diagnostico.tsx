import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, ArrowRightCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_adminLayout/admin/diagnostico")({
  component: DiagnosticoPage,
});

type ProbeResult = {
  endpoint: string;
  method: string;
  variant: string;
  url: string;
  status: number;
  redirected: boolean;
  location: string | null;
  bodyPreview: string;
  ok: boolean;
};

type DiagnosticsResponse = {
  baseUrl: string;
  generatedAt: string;
  summary: {
    tokenConfigured: boolean;
    placeholderRecognized: boolean;
    totals: { ok: number; redirects: number; unauthorized: number; serverErrors: number; failed: number };
  };
  probes: ProbeResult[];
};

function statusVariant(p: ProbeResult): { color: string; label: string; icon: React.ElementType } {
  if (p.status === 0) return { color: "bg-destructive/15 text-destructive", label: "FAIL", icon: AlertCircle };
  if (p.redirected) return { color: "bg-amber-500/15 text-amber-700 dark:text-amber-400", label: `${p.status} REDIR`, icon: ArrowRightCircle };
  if (p.status === 401) return { color: "bg-orange-500/15 text-orange-700 dark:text-orange-400", label: "401", icon: ShieldAlert };
  if (p.status >= 500) return { color: "bg-destructive/15 text-destructive", label: `${p.status}`, icon: AlertCircle };
  if (p.ok) return { color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: `${p.status}`, icon: CheckCircle2 };
  return { color: "bg-muted text-muted-foreground", label: `${p.status}`, icon: AlertCircle };
}

function DiagnosticoPage() {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalSec, setIntervalSec] = useState(15);
  const [endpointFilter, setEndpointFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const timerRef = useRef<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/consumer/diagnostics?ts=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as DiagnosticsResponse;
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (autoRefresh) {
      timerRef.current = window.setInterval(load, Math.max(3, intervalSec) * 1000);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [autoRefresh, intervalSec]);

  const endpoints = useMemo(() => Array.from(new Set((data?.probes ?? []).map((p) => p.endpoint))).sort(), [data]);
  const methods = useMemo(() => Array.from(new Set((data?.probes ?? []).map((p) => p.method))).sort(), [data]);

  const filtered = useMemo(() => {
    const list = data?.probes ?? [];
    return list.filter((p) => {
      if (endpointFilter !== "all" && p.endpoint !== endpointFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (statusFilter === "ok" && !p.ok) return false;
      if (statusFilter === "redirect" && !p.redirected) return false;
      if (statusFilter === "unauthorized" && p.status !== 401) return false;
      if (statusFilter === "error" && !(p.status >= 500 || p.status === 0)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.variant.toLowerCase().includes(q) && !p.url.toLowerCase().includes(q) && !p.bodyPreview.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data, endpointFilter, methodFilter, statusFilter, search]);

  const totals = data?.summary.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Diagnóstico Consumer</h1>
          <p className="text-sm text-muted-foreground">
            Probes em tempo real contra <code>/api/consumer/*</code>. Use os filtros para isolar 307/401.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1">
            <Label className="text-xs">Endpoint</Label>
            <Select value={endpointFilter} onValueChange={setEndpointFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {endpoints.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Método</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">OK (2xx)</SelectItem>
                <SelectItem value="redirect">Redirects (3xx)</SelectItem>
                <SelectItem value="unauthorized">401</SelectItem>
                <SelectItem value="error">5xx / falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs">Buscar (variant / url / body)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="placeholder, status, fakeid..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Auto-refresh</Label>
            <div className="flex items-center gap-2">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Input
                type="number" min={3} max={300}
                value={intervalSec}
                onChange={(e) => setIntervalSec(Number(e.target.value) || 15)}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">s</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <SummaryCard label="OK" value={totals?.ok ?? 0} tone="emerald" />
            <SummaryCard label="Redirects" value={totals?.redirects ?? 0} tone="amber" />
            <SummaryCard label="401" value={totals?.unauthorized ?? 0} tone="orange" />
            <SummaryCard label="5xx" value={totals?.serverErrors ?? 0} tone="destructive" />
            <SummaryCard label="Falhas fetch" value={totals?.failed ?? 0} tone="destructive" />
            <SummaryCard
              label="Token"
              value={data.summary.tokenConfigured ? "OK" : "AUSENTE"}
              tone={data.summary.tokenConfigured ? "emerald" : "destructive"}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                Probes ({filtered.length}/{data.probes.length})
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Atualizado em {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.map((p, i) => {
                const v = statusVariant(p);
                const Icon = v.icon;
                return (
                  <div
                    key={`${p.variant}-${i}`}
                    className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm md:flex-row md:items-start md:gap-4"
                  >
                    <div className="flex items-center gap-2 md:w-32">
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", v.color)}>
                        <Icon className="h-3 w-3" /> {v.label}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{p.method}</Badge>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-xs font-medium">{p.variant}</code>
                        {p.location && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            → {p.location}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{p.url}</div>
                      {p.bodyPreview && (
                        <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px] leading-tight text-muted-foreground">
                          {p.bodyPreview}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum probe corresponde aos filtros.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone: "emerald" | "amber" | "orange" | "destructive" }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    amber: "text-amber-700 dark:text-amber-400",
    orange: "text-orange-700 dark:text-orange-400",
    destructive: "text-destructive",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-semibold", tones[tone])}>{value}</div>
      </CardContent>
    </Card>
  );
}
