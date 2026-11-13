import { create } from 'zustand';

// Cart lines live in memory for this app session. They are not saved to the server.
interface CartState {
  quantities: Record<string, number>;
  add: (productId: string, stock: number) => void;
  setQuantity: (productId: string, quantity: number, stock: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()((set) => ({
  quantities: {},
  add: (productId, stock) =>
    set((state) => {
      const current = state.quantities[productId] ?? 0;
      if (current >= stock) return state;
      return { quantities: { ...state.quantities, [productId]: current + 1 } };
    }),
  setQuantity: (productId, quantity, stock) =>
    set((state) => {
      if (quantity <= 0) {
        const { [productId]: _removed, ...rest } = state.quantities;
        return { quantities: rest };
      }
      return { quantities: { ...state.quantities, [productId]: Math.min(quantity, stock) } };
    }),
  remove: (productId) =>
    set((state) => {
      const { [productId]: _removed, ...rest } = state.quantities;
      return { quantities: rest };
    }),
  clear: () => set({ quantities: {} }),
}));
