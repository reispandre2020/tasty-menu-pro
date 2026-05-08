import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS } from "@/lib/consumer-auth.server";

// GET /api/consumer/orders?status=pending&since=ISO
// Polling para o Consumer puxar pedidos novos / atualizados.
export const Route = createFileRoute("/api/consumer/orders")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const denied = checkConsumerAuth(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const since = url.searchParams.get("since");
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

        let q = supabaseAdmin
          .from("orders")
          .select("id, short_code, mode, status, customer_name, customer_phone, customer_address, table_number, notes, subtotal, delivery_fee, total, payment_method, consumer_external_id, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (status) q = q.eq("status", status);
        if (since) q = q.gte("updated_at", since);

        const { data, error } = await q;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS } });
        return new Response(JSON.stringify({ orders: data ?? [], count: data?.length ?? 0 }), {
          status: 200,
          headers: { "content-type": "application/json", ...CORS_HEADERS },
        });
      },
    },
  },
});
