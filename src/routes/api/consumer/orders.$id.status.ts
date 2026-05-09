import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS } from "@/lib/consumer-auth.server";
import { CONSUMER_STATUS_TO_INTERNAL } from "@/lib/consumer-mappers.server";

// PATCH /api/consumer/orders/:id/status — Consumer atualiza status do pedido
// Body oficial: { orderId, status, justification? }
// Status oficiais: CONFIRMED | CANCELLED | READY_FOR_PICKUP | DISPATCHED | CONCLUDED
const PatchSchema = z.object({
  orderId: z.string().min(1).optional(),
  status: z.enum(["CONFIRMED", "CANCELLED", "READY_FOR_PICKUP", "DISPATCHED", "CONCLUDED"]),
  justification: z.string().max(500).optional(),
  consumer_external_id: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/consumer/orders/$id/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      PATCH: async ({ request, params }) => {
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
          .eq("id", params.id)
          .select("id")
          .maybeSingle();

        if (error) {
          return new Response(JSON.stringify({ statusCode: 500, reasonPhrase: error.message }), {
            status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }
        if (!data) {
          return new Response(JSON.stringify({ statusCode: 404, reasonPhrase: "not_found" }), {
            status: 404, headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }

        return new Response(
          JSON.stringify({
            statusCode: 0,
            reasonPhrase: `${params.id} alterado para '${parsed.data.status}': ${parsed.data.justification ?? "ok"}.`,
          }),
          { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } },
        );
      },
    },
  },
});
