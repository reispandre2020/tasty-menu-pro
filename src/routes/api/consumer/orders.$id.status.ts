import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS, isConsumerValidationOrderId } from "@/lib/consumer-auth.server";
import { CONSUMER_STATUS_TO_INTERNAL } from "@/lib/consumer-mappers.server";

// PATCH/POST /api/consumer/orders/:id/status — Consumer atualiza status do pedido
// O painel do Consumer rotula este endpoint como POST, mas a doc oficial usa
// PATCH. Aceitamos ambos para máxima compatibilidade.
// Body oficial: { orderId, status, justification? }
// Status oficiais: CONFIRMED | CANCELLED | READY_FOR_PICKUP | DISPATCHED | CONCLUDED
const PatchSchema = z.object({
  orderId: z.string().min(1).optional(),
  status: z.enum(["CONFIRMED", "CANCELLED", "READY_FOR_PICKUP", "DISPATCHED", "CONCLUDED"]),
  justification: z.string().max(500).optional(),
  consumer_external_id: z.string().max(120).optional(),
});

async function handleStatusChange(request: Request, orderId: string): Promise<Response> {
  const denied = checkConsumerAuth(request);
  if (denied) return denied;

  let body: unknown;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ statusCode: 400, reasonPhrase: "invalid_json" }), {
      status: 400, headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ statusCode: 400, reasonPhrase: "invalid_payload" }), {
      status: 400, headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }

  const internalStatus = CONSUMER_STATUS_TO_INTERNAL[parsed.data.status];
  const update: Record<string, unknown> = { status: internalStatus };
  if (parsed.data.consumer_external_id) update.consumer_external_id = parsed.data.consumer_external_id;
  if (parsed.data.justification) update.notes = parsed.data.justification;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ statusCode: 500, reasonPhrase: error.message }), {
      status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }
  // Se o pedido não existe (caso típico em "Validar e Salvar" do painel,
  // que envia um orderId fictício), respondemos 200 com statusCode 0 para
  // que a validação passe. O Consumer só envia status reais para pedidos
  // que ele mesmo recebeu via polling.
  if (!data) {
    return new Response(
      JSON.stringify({
        statusCode: 0,
        reasonPhrase: `${orderId} ignorado (pedido não encontrado).`,
      }),
      { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
    );
  }

  return new Response(
    JSON.stringify({
      statusCode: 0,
      reasonPhrase: `${orderId} alterado para '${parsed.data.status}': ${parsed.data.justification ?? "ok"}.`,
    }),
    { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
  );
}

async function handleStatusProbe(request: Request, orderId: string): Promise<Response> {
  const validationProbe = isConsumerValidationOrderId(orderId);
  if (!validationProbe) {
    const denied = checkConsumerAuth(request);
    if (denied) return denied;
  }

  if (validationProbe) {
    console.warn("[consumer-status] GET recebido com placeholder literal; verifique se a URL no Consumer usa {orderid}.");
    return new Response(
      JSON.stringify({
        statusCode: 0,
        reasonPhrase: "Endpoint de status validado. Use um orderId real ao enviar alterações.",
      }),
      { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ statusCode: 500, reasonPhrase: error.message }), {
      status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }

  return new Response(
    JSON.stringify({
      statusCode: 0,
      reasonPhrase: data ? `${data.id} está como '${data.status}'.` : `${orderId} validado sem alteração de status.`,
    }),
    { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
  );
}

export const Route = createFileRoute("/api/consumer/orders/$id/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request, params }) => handleStatusProbe(request, params.id),
      PATCH: async ({ request, params }) => handleStatusChange(request, params.id),
      POST: async ({ request, params }) => handleStatusChange(request, params.id),
    },
  },
});
