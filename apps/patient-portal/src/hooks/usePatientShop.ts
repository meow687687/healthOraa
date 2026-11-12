import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withSingleFallback } from "@healthoraa/ui";
import { checkoutOrderSchema } from "@healthoraa/validation";
import type { CheckoutOrderInput } from "@healthoraa/validation";
import type { Enums } from "@healthoraa/types";
import { supabase } from "../lib/supabase";
import { usePatient } from "../context/PatientContext";
import { readCart, writeCart } from "../lib/cartStore";
import { summariseCart, trackingIdFor } from "../lib/cartMath";
import type { CartSummary } from "../lib/cartMath";
import { FALLBACK_PRODUCTS } from "../lib/shopFallback";
import type { CartEntry, OrderConfirmation, ShopProduct, StoredCartLine } from "../types/shop";

export const shopProductsKey = ["shop", "products"] as const;
export const cartKey = (patientId: string) => ["shop", "cart", patientId] as const;

// Simulated payment delay. Mock payment: no money moves.
export const PAYMENT_DELAY_MS = 800;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface ProductRow {
  id: string;
  sku: string;
  title: string;
  category: Enums<"product_category">;
  description: string | null;
  price_inr: number;
  stock_count: number;
}

// Active products. Falls back to the demo catalogue only when the read fails.
export const useShopProducts = () =>
  useQuery<ShopProduct[], Error>({
    queryKey: shopProductsKey,
    queryFn: () =>
      withSingleFallback(
        async () => {
          const { data, error } = await supabase
            .from("products")
            .select("id, sku, title, category, description, price_inr, stock_count")
            .eq("is_active", true)
            .order("title", { ascending: true });
          if (error) throw new Error(error.message);
          return ((data ?? []) as ProductRow[]).map<ShopProduct>((row) => ({
            id: row.id,
            sku: row.sku,
            title: row.title,
            category: row.category,
            description: row.description ?? "Wellness product",
            priceInr: Number(row.price_inr),
            stock: row.stock_count,
            dataSource: "live",
          }));
        },
        FALLBACK_PRODUCTS,
        "shop products",
      ),
  });

export const useStoredCart = () => {
  const patient = usePatient();
  return useQuery<StoredCartLine[], Error>({
    queryKey: cartKey(patient.id),
    queryFn: async () => readCart(patient.id),
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Cart lines joined to the catalogue, with totals. Lines whose product has gone are kept with product null.
export const useCart = () => {
  const products = useShopProducts();
  const stored = useStoredCart();

  const entries = useMemo<CartEntry[]>(() => {
    const catalogue = products.data ?? [];
    return (stored.data ?? []).map((line) => ({
      productId: line.productId,
      product: catalogue.find((product) => product.id === line.productId) ?? null,
      quantity: line.quantity,
    }));
  }, [products.data, stored.data]);

  const available = useMemo(
    () => entries.filter((entry): entry is CartEntry & { product: ShopProduct } => entry.product !== null),
    [entries],
  );
  const summary: CartSummary = useMemo(() => summariseCart(available), [available]);
  const unavailableCount = entries.length - available.length;

  return { products, stored, entries, summary, unavailableCount, isPending: products.isPending || stored.isPending };
};

export const useAddToCart = () => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<StoredCartLine[], Error, ShopProduct>({
    mutationFn: async (product) => {
      if (product.stock <= 0) throw new Error(`${product.title} is out of stock.`);
      const current = readCart(patient.id);
      const existing = current.find((line) => line.productId === product.id);
      const quantity = (existing?.quantity ?? 0) + 1;
      if (quantity > product.stock) throw new Error(`Only ${product.stock} of ${product.title} left.`);

      const next = existing
        ? current.map((line) => (line.productId === product.id ? { ...line, quantity } : line))
        : [...current, { productId: product.id, quantity: 1 }];
      writeCart(patient.id, next);
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(cartKey(patient.id), next),
  });
};

export const useUpdateCartQuantity = () => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<StoredCartLine[], Error, { product: ShopProduct; quantity: number }>({
    mutationFn: async ({ product, quantity }) => {
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Quantity must be at least 1.");
      if (quantity > product.stock) throw new Error(`Only ${product.stock} of ${product.title} left.`);
      const next = readCart(patient.id).map((line) => (line.productId === product.id ? { ...line, quantity } : line));
      writeCart(patient.id, next);
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(cartKey(patient.id), next),
  });
};

export const useRemoveCartItem = () => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<StoredCartLine[], Error, string>({
    mutationFn: async (productId) => {
      const next = readCart(patient.id).filter((line) => line.productId !== productId);
      writeCart(patient.id, next);
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(cartKey(patient.id), next),
  });
};

const formatShippingAddress = (checkout: CheckoutOrderInput): string =>
  `${checkout.full_name}, ${checkout.phone}, ${checkout.address_line}, ${checkout.city}, ${checkout.state} - ${checkout.pincode}`;

// Validates the shipping address and the stock, runs the mock payment, then records the order.
// The order row stores the total and address only, since no order-items table exists yet.
export const usePlaceOrder = () => {
  const patient = usePatient();
  const queryClient = useQueryClient();

  return useMutation<OrderConfirmation, Error, { entries: CartEntry[]; checkout: CheckoutOrderInput }>({
    mutationFn: async ({ entries, checkout }) => {
      const parsed = checkoutOrderSchema.safeParse(checkout);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the shipping address.");
      if (entries.length === 0) throw new Error("Your cart is empty.");

      const priced: { product: ShopProduct; quantity: number }[] = [];
      for (const entry of entries) {
        if (!entry.product) throw new Error("Remove unavailable items before placing the order.");
        if (entry.quantity > entry.product.stock) {
          throw new Error(`Only ${entry.product.stock} of ${entry.product.title} left. Lower the quantity to continue.`);
        }
        priced.push({ product: entry.product, quantity: entry.quantity });
      }
      const summary = summariseCart(priced);

      await wait(PAYMENT_DELAY_MS);

      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_id: patient.id,
          total_amount_inr: summary.totalPaise / 100,
          status: "pending",
          shipping_address: formatShippingAddress(parsed.data),
        })
        .select("id")
        .single();
      if (error) throw new Error(`The order could not be placed: ${error.message}`);

      writeCart(patient.id, []);
      return { orderId: data.id, trackingId: trackingIdFor(data.id), units: summary.units, totalPaise: summary.totalPaise };
    },
    onSuccess: () => queryClient.setQueryData(cartKey(patient.id), []),
  });
};
