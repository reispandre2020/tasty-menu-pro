import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET /api/public/orders/:id — usado pela página de acompanhamento do cliente.
// Retorna apenas dados não sensíveis do pedido.
export const Route = createFileRoute("/api/public/orders/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!/^[0-9a-f-]{10,}$/i.test(id)) {
          return new Response("Invalid id", { status: 400 });
        }
        const { data: order, error } = await supabaseAdmin
          .from("orders")
          .select("id, short_code, mode, status, customer_name, customer_address, table_number, notes, subtotal, delivery_fee, total, created_at, updated_at")
          .eq("id", id)
          .maybeSingle();
        if (error) return new Response(error.message, { status: 500 });
        if (!order) return new Response("Not found", { status: 404 });
        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("id, product_name, unit_price, quantity, notes, subtotal")
          .eq("order_id", id);
        return Response.json({ order, items: items ?? [] });
      },
    },
  },
});
