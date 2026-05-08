import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkConsumerAuth, CORS_HEADERS } from "@/lib/consumer-auth.server";

const PatchSchema = z.object({
  status: z.enum(["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]),
  consumer_external_id: z.string().min(1).max(120).optional(),
});

// PATCH /api/consumer/orders/:id/status — Consumer atualiza status do pedido
export const Route = createFileRoute("/api/consumer/orders/$id/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      PATCH: async ({ request, params }) => {
        const denied = checkConsumerAuth(request);
        if (denied) return denied;

        let body: unknown;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "content-type": "application/json", ...CORS_HEADERS } }); }
        const parsed = PatchSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid_payload", details: parsed.error.flatten() }), { status: 400, headers: { "content-type": "application/json", ...CORS_HEADERS } });
        }
        const update: Record<string, unknown> = { status: parsed.data.status };
        if (parsed.data.consumer_external_id) update.consumer_external_id = parsed.data.consumer_external_id;

        const { data, error } = await supabaseAdmin
          .from("orders")
          .update(update)
          .eq("id", params.id)
          .select("id, status, updated_at")
          .maybeSingle();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS } });
        if (!data) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json", ...CORS_HEADERS } });
        return new Response(JSON.stringify({ ok: true, order: data }), { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } });
      },
    },
  },
});
