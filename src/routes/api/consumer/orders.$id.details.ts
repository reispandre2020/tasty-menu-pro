import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS, isConsumerValidationOrderId } from "@/lib/consumer-auth.server";
import { buildOrderDetails, getConsumerExternalCode } from "@/lib/consumer-mappers.server";
import type { Order, OrderItem } from "@/lib/menu-types";

async function handleOrderDetails(request: Request, orderId: string): Promise<Response> {
  const validationProbe = isConsumerValidationOrderId(orderId);
  if (!validationProbe) {
    const denied = checkConsumerAuth(request);
    if (denied) return denied;
  }

  if (validationProbe) {
    return new Response(JSON.stringify({
      item: null,
      statusCode: 0,
      reasonPhrase: "Endpoint de detalhes validado. Use um orderId real nas chamadas operacionais.",
    }), { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } });
  }

  const [{ data: order, error }, { data: items }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("orders").select("*").eq("id", orderId).maybeSingle(),
    supabaseAdmin.from("order_items").select("*").eq("order_id", orderId),
    supabaseAdmin.from("store_settings").select("consumer_merchant_id, store_name").limit(1).maybeSingle(),
  ]);

  if (error) {
    return new Response(JSON.stringify({ statusCode: 500, reasonPhrase: error.message }), {
      status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!order) {
    return new Response(JSON.stringify({ item: null, statusCode: 0, reasonPhrase: `${orderId} não encontrado (resposta de validação).` }), {
      status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }

  const productIds = (items ?? []).map((it) => it.product_id).filter(Boolean) as string[];
  const productMap = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: prods } = await supabaseAdmin.from("products").select("id, external_code, extra_fields").in("id", productIds);
    (prods ?? []).forEach((p) => productMap.set(p.id, getConsumerExternalCode(p)));
  }
  const itemsWithCode = (items as OrderItem[]).map((it) => ({
    ...it,
    external_code: it.product_id ? productMap.get(it.product_id) ?? "" : "",
  }));

  const payload = buildOrderDetails(order as Order, itemsWithCode, {
    id: settings?.consumer_merchant_id ?? "",
    name: settings?.store_name ?? "",
  });
  payload.item.items = payload.item.items.map((it, idx) => ({ ...it, externalCode: itemsWithCode[idx]?.external_code ?? "" }));

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

export const Route = createFileRoute("/api/consumer/orders/$id/details")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request, params }) => handleOrderDetails(request, params.id),
      POST: async ({ request, params }) => handleOrderDetails(request, params.id),
    },
  },
});