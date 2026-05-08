import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS } from "@/lib/consumer-auth.server";

// GET /api/consumer/orders/:id — detalhes (header + itens)
export const Route = createFileRoute("/api/consumer/orders/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request, params }) => {
        const denied = checkConsumerAuth(request);
        if (denied) return denied;

        const { data: order, error } = await supabaseAdmin
          .from("orders")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS } });
        if (!order) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json", ...CORS_HEADERS } });
        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("*")
          .eq("order_id", params.id);
        return new Response(JSON.stringify({ order, items: items ?? [] }), {
          status: 200,
          headers: { "content-type": "application/json", ...CORS_HEADERS },
        });
      },
    },
  },
});
