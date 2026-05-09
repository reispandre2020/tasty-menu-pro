import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, isConsumerValidationOrderId } from "@/lib/consumer-auth.server";

// GET /api/consumer/diagnostics
// Diagnóstico em tempo real dos endpoints do Consumer.
// Faz auto-fetch nos endpoints principais usando: (a) placeholder literal
// {orderId} e (b) ID inexistente real, com e sem token, e reporta o status
// HTTP retornado em cada caso. Útil para confirmar onde está o 307/401 que
// quebra o polling do painel.

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

async function probe(
  baseUrl: string,
  endpoint: string,
  method: string,
  variant: string,
  pathSuffix: string,
  body: unknown,
  token: string | null,
): Promise<ProbeResult> {
  const url = `${baseUrl}${endpoint}${pathSuffix}`;
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined && method !== "GET" ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
  } catch (err) {
    return {
      endpoint, method, variant, url,
      status: 0, redirected: false, location: null,
      bodyPreview: `fetch_error: ${(err as Error).message}`, ok: false,
    };
  }
  const text = await res.text().catch(() => "");
  return {
    endpoint, method, variant, url,
    status: res.status,
    redirected: res.status >= 300 && res.status < 400,
    location: res.headers.get("location"),
    bodyPreview: text.slice(0, 200),
    ok: res.status >= 200 && res.status < 300,
  };
}

export const Route = createFileRoute("/api/consumer/diagnostics")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        const tokenConfigured = !!(process.env.CONSUMER_API_TOKEN ?? "").trim();
        const token = (process.env.CONSUMER_API_TOKEN ?? "").trim() || null;

        const placeholderEnc = encodeURIComponent("{orderId}");
        const fakeId = "00000000-0000-0000-0000-000000000000";

        const probes: Array<Promise<ProbeResult>> = [
          // Polling principal — sem token e com token
          probe(baseUrl, "/api/consumer/orders", "GET", "no_token", "", undefined, null),
          probe(baseUrl, "/api/consumer/orders", "GET", "with_token", "", undefined, token),

          // Status endpoint — placeholder literal
          probe(baseUrl, "/api/consumer/orders", "GET", "status_placeholder_no_token", `/${placeholderEnc}/status`, undefined, null),
          probe(baseUrl, "/api/consumer/orders", "POST", "status_placeholder_no_token", `/${placeholderEnc}/status`, { orderId: "{orderId}", status: "CONFIRMED" }, null),
          probe(baseUrl, "/api/consumer/orders", "PATCH", "status_placeholder_no_token", `/${placeholderEnc}/status`, { orderId: "{orderId}", status: "CONFIRMED" }, null),
          probe(baseUrl, "/api/consumer/orders", "PUT", "status_placeholder_no_token", `/${placeholderEnc}/status`, { orderId: "{orderId}", status: "CONFIRMED" }, null),

          // Status endpoint — id inexistente (deve exigir token)
          probe(baseUrl, "/api/consumer/orders", "GET", "status_fakeid_no_token", `/${fakeId}/status`, undefined, null),
          probe(baseUrl, "/api/consumer/orders", "GET", "status_fakeid_with_token", `/${fakeId}/status`, undefined, token),

          // Detalhes (rota dinâmica) — placeholder
          probe(baseUrl, "/api/consumer/orders", "GET", "details_placeholder_no_token", `/${placeholderEnc}`, undefined, null),
          probe(baseUrl, "/api/consumer/orders", "GET", "details_fakeid_no_token", `/${fakeId}`, undefined, null),
          probe(baseUrl, "/api/consumer/orders", "GET", "details_fakeid_with_token", `/${fakeId}`, undefined, token),

          // Endpoint POST /orders/details
          probe(baseUrl, "/api/consumer/orders/details", "POST", "details_post_placeholder", "", { OrderId: "{orderId}" }, null),
          probe(baseUrl, "/api/consumer/orders/details", "POST", "details_post_fakeid_no_token", "", { OrderId: fakeId }, null),
          probe(baseUrl, "/api/consumer/orders/details", "POST", "details_post_fakeid_with_token", "", { OrderId: fakeId }, token),

          // Variantes de path com / final e maiúsculas
          probe(baseUrl, "/api/consumer/orders", "GET", "status_trailing_slash", `/${placeholderEnc}/status/`, undefined, null),
          probe(baseUrl, "/api/consumer/orders", "GET", "status_uppercase", `/${placeholderEnc}/Status`, undefined, null),
        ];

        const results = await Promise.all(probes);

        const summary = {
          tokenConfigured,
          placeholderRecognized: isConsumerValidationOrderId("{orderId}"),
          totals: {
            ok: results.filter((r) => r.ok).length,
            redirects: results.filter((r) => r.redirected).length,
            unauthorized: results.filter((r) => r.status === 401).length,
            serverErrors: results.filter((r) => r.status >= 500).length,
            failed: results.filter((r) => r.status === 0).length,
          },
          placeholdersBlocking: results.filter(
            (r) => r.variant.includes("placeholder") && (r.redirected || r.status === 401 || r.status >= 500),
          ),
          unauthorizedHits: results.filter((r) => r.status === 401),
          redirectHits: results.filter((r) => r.redirected),
        };

        return new Response(
          JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), summary, probes: results }, null, 2),
          { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
        );
      },
    },
  },
});
