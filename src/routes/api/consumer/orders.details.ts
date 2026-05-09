import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS, isConsumerValidationOrderId } from "@/lib/consumer-auth.server";
import { buildOrderPush, getConsumerExternalCode } from "@/lib/consumer-mappers.server";
import type { Order, OrderItem } from "@/lib/menu-types";

// POST /api/consumer/orders/details
// Endpoint chamado pelo Consumer após receber o evento ORDER_DETAILS_REQUESTED.
// Recebe { OrderId, EventCode, EventFull } e responde com TODOS os detalhes
// do pedido no formato camelCase oficial.
const PostSchema = z.object({
  OrderId: z.string().min(1).max(120),
  EventCode: z.string().max(20).optional(),
  EventFull: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/consumer/orders/details")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ statusCode: 400, reasonPhrase: "invalid_json" }), {
            status: 400, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        const maybeOrderId = body && typeof body === "object"
          ? (body as Record<string, unknown>).OrderId ?? (body as Record<string, unknown>).orderId ?? (body as Record<string, unknown>).id
          : undefined;
        const validationProbe = typeof maybeOrderId === "string" && isConsumerValidationOrderId(maybeOrderId);
        if (!validationProbe) {
          const denied = checkConsumerAuth(request);
          if (denied) return denied;
        }

        const parsed = PostSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ statusCode: 400, reasonPhrase: "invalid_payload" }), {
            status: 400, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        const orderId = parsed.data.OrderId;
        if (validationProbe) {
          return new Response(JSON.stringify({
            statusCode: 0,
            reasonPhrase: "Endpoint de envio de detalhes validado. Use um OrderId real nas chamadas operacionais.",
          }), {
            status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        const [{ data: order }, { data: items }, { data: settings }] = await Promise.all([
          supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle(),
          supabaseAdmin.from("order_items").select("*").eq("order_id", orderId),
          supabaseAdmin.from("store_settings").select("consumer_merchant_id, store_name").limit(1).maybeSingle(),
        ]);

        if (!order) {
          // Tolerância para validação do painel (orderId fictício)
          return new Response(JSON.stringify({
            statusCode: 0,
            reasonPhrase: `${orderId} não encontrado (resposta de validação).`,
          }), {
            status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        const productIds = (items ?? []).map((it) => it.product_id).filter(Boolean) as string[];
        const productMap = new Map<string, string | null>();
        if (productIds.length > 0) {
          const { data: prods } = await supabaseAdmin
            .from("products").select("id, external_code, extra_fields").in("id", productIds);
          (prods ?? []).forEach((p) => productMap.set(p.id, getConsumerExternalCode(p)));
        }
        const itemsWithCode = (items as OrderItem[]).map((it) => ({
          ...it,
          external_code: it.product_id ? productMap.get(it.product_id) ?? "" : "",
        }));

        const payload = buildOrderPush(
          order as Order,
          itemsWithCode,
          { id: settings?.consumer_merchant_id ?? "", name: settings?.store_name ?? "" },
        );

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json", ...CORS_HEADERS },
        });
      },
    },
  },
});
