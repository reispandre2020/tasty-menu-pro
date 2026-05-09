// Mapeamentos do nosso schema interno para o formato oficial do Programa Consumer.
// Doc: https://ajuda.programaconsumer.com.br/integracao-api-do-parceiro/

import type { Order, OrderItem, OrderStatus } from "@/lib/menu-types";

// ----- Status oficiais aceitos pelo Consumer -----
export const CONSUMER_STATUS_TO_INTERNAL: Record<string, OrderStatus> = {
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  READY_FOR_PICKUP: "ready",
  DISPATCHED: "out_for_delivery",
  CONCLUDED: "delivered",
};

export const INTERNAL_STATUS_TO_CONSUMER: Record<OrderStatus, { code: string; full: string } | null> = {
  pending: { code: "PLC", full: "PLACED" },
  confirmed: { code: "CFM", full: "CONFIRMED" },
  preparing: { code: "CFM", full: "CONFIRMED" },
  ready: { code: "RPU", full: "READY_FOR_PICKUP" },
  out_for_delivery: { code: "DSP", full: "DISPATCHED" },
  delivered: { code: "CON", full: "CONCLUDED" },
  cancelled: { code: "CAN", full: "CANCELLED" },
};

// ----- Métodos de pagamento -> Enum oficial -----
export function mapPaymentMethod(m: string | null): { method: string; type: string; brand?: string } {
  switch ((m ?? "").toLowerCase()) {
    case "cash":   return { method: "CASH",   type: "PENDING" };
    case "credit": return { method: "CREDIT", type: "PENDING", brand: "OTHER" };
    case "debit":  return { method: "DEBIT",  type: "PENDING", brand: "OTHER" };
    case "pix":    return { method: "PIX",    type: "PENDING" };
    default:       return { method: "OTHER",  type: "PENDING" };
  }
}

// ----- GET /api/consumer/orders/:id (formato de consulta de detalhes) -----
export function buildOrderDetails(order: Order, items: OrderItem[], merchant: { id: string; name: string }) {
  const pay = mapPaymentMethod(order.payment_method);
  const deliveryAddress = order.address_street ? {
    country: "BR",
    state: order.address_state ?? "",
    city: order.address_city ?? "",
    postalCode: (order.address_zip ?? "").replace(/\D/g, ""),
    streetName: order.address_street ?? "",
    streetNumber: order.address_number ?? "",
    neighborhood: order.address_neighborhood ?? "",
    complement: order.address_complement ?? null,
    reference: order.address_reference ?? null,
    formattedAddress: order.customer_address ?? "",
    coordinates: { latitude: 0, longitude: 0 },
  } : null;

  return {
    item: {
      id: order.id,
      displayId: order.short_code,
      orderType: order.mode === "delivery" ? "DELIVERY" : order.mode === "pickup" ? "TAKEOUT" : "INDOOR",
      salesChannel: "PARTNER",
      orderTiming: "IMMEDIATE",
      createdAt: order.created_at,
      preparationStartDateTime: order.created_at,
      merchant,
      total: {
        subTotal: Number(order.subtotal),
        deliveryFee: Number(order.delivery_fee),
        orderAmount: Number(order.total),
        benefits: 0,
        additionalFees: 0,
      },
      payments: {
        methods: [{
          method: pay.method,
          type: pay.type,
          currency: "BRL",
          value: Number(order.total),
          prepaid: false,
          card: pay.brand ? { brand: pay.brand } : null,
          cash: order.change_for ? { changeFor: Number(order.change_for) } : null,
          wallet: null,
        }],
        pending: Number(order.total),
        prepaid: 0,
      },
      customer: {
        id: order.id, // não temos cadastro de cliente; usamos o id do pedido
        name: order.customer_name,
        phone: {
          number: order.customer_phone,
          localizer: "",
          localizerExpiration: order.created_at,
        },
        documentNumber: order.customer_document ?? null,
        ordersCountOnMerchant: null,
        segmentation: "Cliente",
      },
      delivery: order.mode === "delivery" ? {
        mode: "DEFAULT",
        deliveredBy: "Merchant",
        pickupCode: order.pickup_code ?? "",
        deliveryDateTime: order.created_at,
        deliveryAddress,
        observations: null,
      } : null,
      takeout: order.mode === "pickup" ? { mode: "DEFAULT" } : null,
      indoor: order.mode === "dine_in" ? { table: order.table_number } : null,
      items: items.map((it, idx) => ({
        id: it.id,
        index: idx + 1,
        externalCode: "", // preenchido externamente (precisamos do produto)
        name: it.product_name,
        unit: "UN",
        ean: null,
        quantity: it.quantity,
        unitPrice: Number(it.unit_price),
        totalPrice: Number(it.subtotal),
        price: Number(it.subtotal),
        observations: it.notes ?? null,
        imageUrl: null,
        options: null,
        uniqueId: it.id,
        optionsPrice: 0,
        addition: 0,
        scalePrices: null,
      })),
      benefits: null,
      extraInfo: order.notes ?? null,
      additionalFees: null,
      schedule: null,
    },
    statusCode: 0,
    reasonPhrase: null,
  };
}

// ----- POST /api/consumer/orders/details (push de detalhes) -----
// Retorna o objeto completo no formato camelCase do "envio dos detalhes do pedido"
export function buildOrderPush(
  order: Order,
  items: Array<OrderItem & { external_code: string | null }>,
  merchant: { id: string; name: string },
) {
  const pay = mapPaymentMethod(order.payment_method);
  return {
    Id: order.id,
    Type: order.mode === "delivery" ? "DELIVERY" : order.mode === "pickup" ? "TAKEOUT" : "INDOOR",
    DisplayId: order.short_code,
    SalesChannel: "PARTNER",
    CreatedAt: order.created_at,
    LastEvent: INTERNAL_STATUS_TO_CONSUMER[order.status]?.full ?? "CREATED",
    OrderTiming: "INSTANT",
    PreparationStartDateTime: order.created_at,
    Merchant: { Id: merchant.id, Name: merchant.name },
    Items: items.map((it, idx) => ({
      Id: it.id,
      Index: idx,
      Name: it.product_name,
      ExternalCode: it.external_code ?? "",
      Unit: "UN",
      Ean: null,
      Quantity: it.quantity,
      SpecialInstructions: it.notes ?? "",
      UnitPrice: { Value: Number(it.unit_price), Currency: "BRL" },
      OriginalPrice: null,
      ScalePriceApplied: false,
      OptionsPrice: { Value: 0, Currency: "BRL" },
      SubtotalPrice: { Value: Number(it.subtotal), Currency: "BRL" },
      TotalPrice: { Value: Number(it.subtotal), Currency: "BRL" },
      Indoor: null,
      Options: [],
      ConsumerItemInfo: null,
    })),
    OtherFees: order.delivery_fee > 0 ? [{
      Name: "TaxaEntrega",
      Type: "DELIVERY_FEE",
      ReceivedBy: "MERCHANT",
      ReceiverDocument: null,
      Price: { Value: Number(order.delivery_fee), Currency: "BRL" },
      Observation: null,
    }] : [],
    Discounts: [],
    Total: {
      ItemsPrice: { Value: Number(order.subtotal), Currency: "BRL" },
      OtherFees: { Value: Number(order.delivery_fee), Currency: "BRL" },
      Discount: { Value: 0, Currency: "BRL" },
      OrderAmount: { Value: Number(order.total), Currency: "BRL" },
    },
    Payments: {
      Prepaid: 0,
      Pending: Number(order.total),
      Methods: [{
        Value: Number(order.total),
        Currency: "BRL",
        Type: pay.type,
        Method: pay.method,
        Brand: pay.brand ?? null,
        MethodInfo: null,
        Transaction: null,
        ChangeFor: order.change_for ? Number(order.change_for) : 0,
      }],
    },
    TaxInvoice: null,
    Customer: {
      Id: order.id,
      Name: order.customer_name,
      DocumentNumber: order.customer_document ?? null,
      Phone: { Number: order.customer_phone, Extension: null },
      Email: null,
      OrdersCountOnMerchant: 0,
    },
    Schedule: null,
    OrderPriority: "PRIORITY1",
    Delivery: order.mode === "delivery" ? {
      DeliveredBy: "MERCHANT",
      DeliveryAddress: {
        Country: "BR",
        State: order.address_state ?? "",
        City: order.address_city ?? "",
        District: order.address_neighborhood ?? "",
        Street: order.address_street ?? "",
        Number: order.address_number ?? "",
        Complement: order.address_complement ?? null,
        Reference: order.address_reference ?? null,
        FormattedAddress: order.customer_address ?? "",
        PostalCode: (order.address_zip ?? "").replace(/\D/g, ""),
        Coordinates: { Latitude: 0, Longitude: 0 },
      },
      EstimatedDeliveryDateTime: order.created_at,
      DeliveryDateTime: null,
      PickupCode: order.pickup_code ?? null,
    } : null,
    Takeout: order.mode === "pickup" ? { Mode: "DEFAULT" } : null,
    Indoor: order.mode === "dine_in" ? { Table: order.table_number } : null,
    SendPreparing: false,
    SendDelivered: false,
    SendPickedUp: false,
    SendTracking: false,
    ExtraInfo: order.notes ?? null,
  };
}
