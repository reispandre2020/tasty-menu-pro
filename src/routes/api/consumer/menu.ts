import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS } from "@/lib/consumer-auth.server";

// GET /api/consumer/menu — cardápio completo para o Programa Consumer
export const Route = createFileRoute("/api/consumer/menu")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const denied = checkConsumerAuth(request);
        if (denied) return denied;

        const [{ data: cats }, { data: prods }, { data: settings }] = await Promise.all([
          supabaseAdmin.from("categories").select("id, name, description, sort_order, is_active").order("sort_order"),
          supabaseAdmin.from("products").select("id, category_id, name, description, price, image_url, is_available, sort_order").order("sort_order"),
          supabaseAdmin.from("store_settings").select("store_name, is_open, delivery_fee, min_order_value, consumer_merchant_id").limit(1).maybeSingle(),
        ]);

        return new Response(
          JSON.stringify({
            store: settings ?? null,
            categories: cats ?? [],
            products: prods ?? [],
            generated_at: new Date().toISOString(),
          }),
          { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
        );
      },
    },
  },
});
