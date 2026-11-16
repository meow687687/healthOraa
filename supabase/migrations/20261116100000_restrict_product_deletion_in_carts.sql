-- Keep active customer carts intact when an admin removes a catalog product.
ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE RESTRICT;
