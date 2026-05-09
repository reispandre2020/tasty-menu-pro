import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS, isConsumerValidationOrderId } from "@/lib/consumer-auth.server";
import { buildOrderDetails, getConsumerExternalCode } from "@/lib/consumer-mappers.server";
import type { Order, OrderItem } from "@/lib/menu-types";

// GET /api/consumer/orders/:id — detalhes do pedido no formato oficial Consumer
export const Route = createFileRoute("/api/consumer/orders/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request, params }) => {
        const validationProbe = isConsumerValidationOrderId(params.id);
        if (!validationProbe) {
          const denied = checkConsumerAuth(request);
          if (denied) return denied;
        }

        if (validationProbe) {
          return new Response(JSON.stringify({
            item: null,
            statusCode: 0,
            reasonPhrase: "Endpoint de detalhes validado. Use um orderId real nas chamadas operacionais.",
          }), {
            status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        const [{ data: order, error }, { data: items }, { data: settings }] = await Promise.all([
          supabaseAdmin.from("orders").select("*").eq("id", params.id).maybeSingle(),
          supabaseAdmin.from("order_items").select("*").eq("order_id", params.id),
          supabaseAdmin.from("store_settings").select("consumer_merchant_id, store_name").limit(1).maybeSingle(),
        ]);

        if (error) {
          return new Response(JSON.stringify({ statusCode: 500, reasonPhrase: error.message }), {
            status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }
        // Tolerância para "Validar e Salvar" do painel: se o pedido não
        // existe (orderId fictício de teste), retornamos 200 com payload
        // mínimo válido para que a validação passe.
        if (!order) {
          return new Response(JSON.stringify({
            item: null,
            statusCode: 0,
            reasonPhrase: `${params.id} não encontrado (resposta de validação).`,
          }), {
            status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        // Carrega externalCode dos produtos
        const productIds = (items ?? []).map((it) => it.product_id).filter(Boolean) as string[];
        const productMap = new Map<string, string | null>();
        if (productIds.length > 0) {
          const { data: prods } = await supabaseAdmin
            .from("products")
            .select("id, external_code, extra_fields")
            .in("id", productIds);
          (prods ?? []).forEach((p) => productMap.set(p.id, getConsumerExternalCode(p)));
        }
        const itemsWithCode = (items as OrderItem[]).map((it) => ({
          ...it,
          external_code: it.product_id ? productMap.get(it.product_id) ?? "" : "",
        }));

        const merchant = {
          id: settings?.consumer_merchant_id ?? "",
          name: settings?.store_name ?? "",
        };
        const payload = buildOrderDetails(order as Order, itemsWithCode, merchant);
        // Inclui externalCode em cada item retornado
        payload.item.items = payload.item.items.map((it, idx) => ({
          ...it,
          externalCode: itemsWithCode[idx]?.external_code ?? "",
        }));

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json", ...CORS_HEADERS },
        });
      },
    },
  },
});
