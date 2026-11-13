import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CheckoutOrderInput } from '@healthoraa/validation';
import { supabase } from '../../lib/supabase';

export const useProducts = () =>
  useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, title, description, category, price_inr, stock_count')
        .eq('is_active', true)
        .order('title', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
  });

// Units sold from non-cancelled orders. Products with no sales follow after the sold ones, with units_sold 0.
export const useBestSellers = () =>
  useQuery({
    queryKey: ['best-sellers'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_best_sellers', { p_limit: 6 });
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const formatShippingAddress = (values: CheckoutOrderInput): string =>
  `${values.full_name}, ${values.phone}, ${values.address_line}, ${values.city}, ${values.state} ${values.pincode}`;

// Places the order in one database transaction: the order, its lines at the current price, and the stock
// decrement. The server sets every price and total. Returns the new order id.
export const usePlaceOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      items: { productId: string; quantity: number }[];
      checkout: CheckoutOrderInput;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('create_mobile_order', {
        p_shipping_address: formatShippingAddress(input.checkout),
        p_items: input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('The order was not created. Try again.');
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['best-sellers'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
