import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS } from "@/lib/consumer-auth.server";

// GET /api/consumer/orders — POLLING DE EVENTOS (formato oficial Consumer).
// Retorna eventos não-lidos e os marca como acknowledged. Aceita ?ack=false
// para dry-run (não marca).
//
// Resposta:
// {
//   "items": [{ id, orderId, createdAt, fullCode, code }],
//   "statusCode": 0,
//   "reasonPhrase": null
// }
export const Route = createFileRoute("/api/consumer/orders")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        // TESTE TEMPORÁRIO: auth desabilitada para diagnosticar se o Consumer
        // está chamando o endpoint. Logamos os headers que chegam para
        // identificar o formato do token usado pelo painel.
        const debugHeaders: Record<string, string> = {};
        request.headers.forEach((v, k) => {
          debugHeaders[k] = v.length > 40 ? `${v.slice(0, 8)}…${v.slice(-4)} (len=${v.length})` : v;
        });
        console.log("[consumer-orders][TEST-NO-AUTH] chamada recebida", JSON.stringify({
          url: request.url,
          headers: debugHeaders,
        }));
        // const denied = checkConsumerAuth(request);
        // if (denied) return denied;

        const url = new URL(request.url);
        const ack = url.searchParams.get("ack") !== "false";
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

        const { data, error } = await supabaseAdmin
          .from("consumer_events")
          .select("id, order_id, code, full_code, created_at")
          .is("acknowledged_at", null)
          .order("created_at", { ascending: true })
          .limit(limit);

        if (error) {
          return new Response(
            JSON.stringify({ items: [], statusCode: 500, reasonPhrase: error.message }),
            { status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS } },
          );
        }

        const items = (data ?? []).map((e) => ({
          id: e.id,
          orderId: e.order_id,
          createdAt: e.created_at,
          fullCode: e.full_code,
          code: e.code,
        }));

        if (ack && items.length > 0) {
          await supabaseAdmin
            .from("consumer_events")
            .update({ acknowledged_at: new Date().toISOString() })
            .in("id", items.map((i) => i.id));
        }

        return new Response(
          JSON.stringify({ items, statusCode: 0, reasonPhrase: null }),
          { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
        );
      },
    },
  },
});
