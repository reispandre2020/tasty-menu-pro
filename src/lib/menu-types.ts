// Tipos do domínio do app (cardápio, pedidos). Nome separado pra não conflitar
// com src/integrations/supabase/types.ts (read-only / gerado).

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderMode = "pickup" | "delivery" | "dine_in";
export type AppRole = "admin" | "staff";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  external_code: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  notes: string | null;
  subtotal: number;
}

export interface Order {
  id: string;
  short_code: string;
  mode: OrderMode;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_document: string | null;
  table_number: string | null;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string | null;
  change_for: number | null;
  pickup_code: string | null;
  address_zip: string | null;
  address_state: string | null;
  address_city: string | null;
  address_neighborhood: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_reference: string | null;
  consumer_external_id: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface StoreSettings {
  id: string;
  store_name: string;
  phone: string | null;
  address: string | null;
  delivery_fee: number;
  min_order_value: number;
  is_open: boolean;
  consumer_merchant_id: string | null;
  consumer_token_hash: string | null;
  updated_at: string;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Aguardando",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  out_for_delivery: "Saiu p/ entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const MODE_LABEL: Record<OrderMode, string> = {
  pickup: "Retirada no balcão",
  delivery: "Delivery",
  dine_in: "Mesa",
};
