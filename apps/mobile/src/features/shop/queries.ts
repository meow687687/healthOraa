import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CheckoutOrderInput } from '@healthoraa/validation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';

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

export const formatShippingAddress = (values: CheckoutOrderInput): string =>
  `${values.full_name}, ${values.phone}, ${values.address_line}, ${values.city}, ${values.state} ${values.pincode}`;

// Creates a pending order for the patient. Totals are computed on the device from the product prices shown.
// The server enforces that only patients place orders for themselves.
export const usePlaceOrder = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { totalPaise: number; checkout: CheckoutOrderInput }): Promise<string> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('orders')
        .insert({
          customer_id: userId,
          total_amount_inr: input.totalPaise / 100,
          status: 'pending',
          shipping_address: formatShippingAddress(input.checkout),
        })
        .select('id')
        .single();
      if (error) throw new Error(`The order could not be placed: ${error.message}`);
      return data.id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders', userId] });
    },
  });
};
