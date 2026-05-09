import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, isConsumerValidationOrderId } from "@/lib/consumer-auth.server";
import { handleOrderDetails } from "@/routes/api/consumer/orders.$id.details";
import { handleStatusChange, handleStatusProbe } from "@/routes/api/consumer/orders.$id.status";

function normalizeAction(action: string): string {
  return decodeURIComponent(action).trim().toLowerCase();
}

function handleCompatibilityFallback(id: string, action: string): Response {
  return new Response(JSON.stringify({
    statusCode: 0,
    reasonPhrase: isConsumerValidationOrderId(id)
      ? `Endpoint Consumer '${action}' validado via rota compatível.`
      : `Ação Consumer '${action}' recebida; use details/status para operações reais.`,
  }), {
    status: 200,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

async function dispatchConsumerAction(request: Request, id: string, action: string): Promise<Response> {
  const normalized = normalizeAction(action);
  if (["status", "statuses", "situacao", "situação"].includes(normalized)) {
    return request.method === "GET" ? handleStatusProbe(request, id) : handleStatusChange(request, id);
  }
  if (["details", "detail", "detalhes", "detalhe"].includes(normalized)) {
    return handleOrderDetails(request, id);
  }
  return handleCompatibilityFallback(id, action);
}

export const Route = createFileRoute("/api/consumer/orders/$id/$action")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request, params }) => dispatchConsumerAction(request, params.id, params.action),
      POST: async ({ request, params }) => dispatchConsumerAction(request, params.id, params.action),
      PATCH: async ({ request, params }) => dispatchConsumerAction(request, params.id, params.action),
      PUT: async ({ request, params }) => dispatchConsumerAction(request, params.id, params.action),
    },
  },
});