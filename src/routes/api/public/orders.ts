import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const JsonHeaders = { "content-type": "application/json" };

const CreateOrderSchema = z.object({
  mode: z.enum(["pickup", "delivery", "dine_in"]),
  customer: z.object({
    name: z.string().trim().min(3).max(120),
    phone: z.string().min(10).max(20).transform((v) => v.replace(/\D/g, "")),
    document: z.string().trim().max(30).nullable().optional(),
  }),
  address: z.object({
    formatted: z.string().max(500).nullable().optional(),
    zip: z.string().max(20).nullable().optional(),
    state: z.string().max(2).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    neighborhood: z.string().max(120).nullable().optional(),
    street: z.string().max(160).nullable().optional(),
    number: z.string().max(30).nullable().optional(),
    complement: z.string().max(160).nullable().optional(),
    reference: z.string().max(240).nullable().optional(),
  }).nullable().optional(),
  paymentMethod: z.string().trim().min(1).max(40),
  changeFor: z.number().min(0).max(99999).nullable().optional(),
  notes: z.string().trim().max(800).nullable().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().trim().max(300).nullable().optional(),
  })).min(1).max(80),
});

export const Route = createFileRoute("/api/public/orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: JsonHeaders });
        }

        const parsed = CreateOrderSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400, headers: JsonHeaders });
        }

        const input = parsed.data;
        const productIds = [...new Set(input.items.map((item) => item.productId))];
        const [{ data: products, error: productsError }, { data: settings }] = await Promise.all([
          supabaseAdmin.from("products").select("id, name, price, is_available").in("id", productIds),
          supabaseAdmin.from("store_settings").select("delivery_fee, min_order_value").limit(1).maybeSingle(),
        ]);

        if (productsError) {
          return new Response(JSON.stringify({ error: productsError.message }), { status: 500, headers: JsonHeaders });
        }

        const productMap = new Map((products ?? []).map((product) => [product.id, product]));
        const missingOrUnavailable = productIds.find((id) => !productMap.get(id)?.is_available);
        if (missingOrUnavailable) {
          return new Response(JSON.stringify({ error: "Produto indisponível no cardápio." }), { status: 409, headers: JsonHeaders });
        }

        const subtotal = input.items.reduce((sum, item) => {
          const product = productMap.get(item.productId)!;
          return sum + Number(product.price) * item.quantity;
        }, 0);
        const minOrder = Number(settings?.min_order_value ?? 0);
        if (subtotal < minOrder) {
          return new Response(JSON.stringify({ error: `Pedido mínimo de R$ ${minOrder.toFixed(2).replace(".", ",")}` }), { status: 409, headers: JsonHeaders });
        }

        const deliveryFee = input.mode === "delivery" ? Number(settings?.delivery_fee ?? 0) : 0;
        const total = subtotal + deliveryFee;
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .insert({
            mode: input.mode,
            status: "pending",
            customer_name: input.customer.name,
            customer_phone: input.customer.phone,
            customer_address: input.mode === "delivery" ? input.address?.formatted ?? null : null,
            customer_document: input.customer.document || null,
            table_number: null,
            notes: input.notes || null,
            subtotal,
            delivery_fee: deliveryFee,
            total,
            payment_method: input.paymentMethod,
            change_for: input.changeFor ?? null,
            address_zip: input.mode === "delivery" ? input.address?.zip?.replace(/\D/g, "") || null : null,
            address_state: input.mode === "delivery" ? input.address?.state || null : null,
            address_city: input.mode === "delivery" ? input.address?.city || null : null,
            address_neighborhood: input.mode === "delivery" ? input.address?.neighborhood || null : null,
            address_street: input.mode === "delivery" ? input.address?.street || null : null,
            address_number: input.mode === "delivery" ? input.address?.number || null : null,
            address_complement: input.mode === "delivery" ? input.address?.complement || null : null,
            address_reference: input.mode === "delivery" ? input.address?.reference || null : null,
          })
          .select("id, short_code")
          .single();

        if (orderError || !order) {
          return new Response(JSON.stringify({ error: orderError?.message ?? "Erro ao criar pedido." }), { status: 500, headers: JsonHeaders });
        }

        const orderItems = input.items.map((item) => {
          const product = productMap.get(item.productId)!;
          const unitPrice = Number(product.price);
          return {
            order_id: order.id,
            product_id: item.productId,
            product_name: product.name,
            unit_price: unitPrice,
            quantity: item.quantity,
            notes: item.notes || null,
            subtotal: unitPrice * item.quantity,
          };
        });
        const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
        if (itemsError) {
          await supabaseAdmin.from("orders").delete().eq("id", order.id);
          return new Response(JSON.stringify({ error: itemsError.message }), { status: 500, headers: JsonHeaders });
        }

        return new Response(JSON.stringify({ order }), { status: 201, headers: JsonHeaders });
      },
    },
  },
});