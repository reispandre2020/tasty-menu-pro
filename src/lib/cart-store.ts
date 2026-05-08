import { useSyncExternalStore } from "react";
import type { Product } from "@/lib/menu-types";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  notes?: string;
}

const STORAGE_KEY = "cart-v1";
type State = { items: CartItem[] };

let state: State = { items: [] };
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch {
    /* ignore */
  }
}
load();

function persist() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  listeners.forEach((l) => l());
}

export const cartStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return state;
  },
  add(product: Product, qty = 1, notes?: string) {
    const existing = state.items.find((i) => i.productId === product.id);
    if (existing) {
      state = {
        items: state.items.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + qty, notes: notes ?? i.notes } : i,
        ),
      };
    } else {
      state = {
        items: [
          ...state.items,
          {
            productId: product.id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url,
            quantity: qty,
            notes,
          },
        ],
      };
    }
    persist();
  },
  setQty(productId: string, qty: number) {
    state = {
      items:
        qty <= 0
          ? state.items.filter((i) => i.productId !== productId)
          : state.items.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)),
    };
    persist();
  },
  remove(productId: string) {
    state = { items: state.items.filter((i) => i.productId !== productId) };
    persist();
  },
  clear() {
    state = { items: [] };
    persist();
  },
};

export function useCart() {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, () => state);
}

export const cartTotal = (items: CartItem[]) =>
  items.reduce((acc, i) => acc + i.price * i.quantity, 0);
