import { useState } from "react";
import type { FormEvent } from "react";
import type { InsertTables, ProductCategory } from "@healthoraa/types";
import { createProductSchema, PRODUCT_CATEGORY_VALUES } from "@healthoraa/validation";
import type { CreateProductInput } from "@healthoraa/validation";
import { useCreateProduct } from "../../hooks/useProducts";
import { PRODUCT_CATEGORY_META } from "./productMeta";
import { Drawer, DrawerHeader } from "../ui/Drawer";
import { cn } from "../../lib/cn";
import {
  BTN_PRIMARY_BLOCK,
  BTN_SECONDARY_BLOCK,
  ERROR_BOX,
  ERROR_TEXT,
  INPUT,
  LABEL,
} from "../ui/tokens";

interface CreateProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProductFormState {
  sku: string;
  title: string;
  category: ProductCategory;
  priceInr: string;
  stockCount: string;
  description: string;
}

type ProductFormErrors = Partial<Record<keyof ProductFormState, string>>;

const INITIAL_FORM: ProductFormState = {
  sku: "",
  title: "",
  category: "supplements",
  priceInr: "",
  stockCount: "0",
  description: "",
};

const FORM_FIELD_BY_SCHEMA_KEY: Record<keyof CreateProductInput, keyof ProductFormState> = {
  sku: "sku",
  title: "title",
  category: "category",
  price_inr: "priceInr",
  stock_count: "stockCount",
  description: "description",
};

const toSchemaInput = (form: ProductFormState): Record<keyof CreateProductInput, unknown> => ({
  sku: form.sku,
  title: form.title,
  category: form.category,
  price_inr: form.priceInr.trim() === "" ? undefined : Number(form.priceInr),
  stock_count: form.stockCount.trim() === "" ? undefined : Number(form.stockCount),
  description: form.description,
});

const validateForm = (
  form: ProductFormState,
): { data: CreateProductInput } | { errors: ProductFormErrors } => {
  const result = createProductSchema.safeParse(toSchemaInput(form));
  if (result.success) return { data: result.data };

  const errors: ProductFormErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    const field = FORM_FIELD_BY_SCHEMA_KEY[key as keyof CreateProductInput];
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { errors };
};

export default function CreateProductDrawer({ isOpen, onClose }: CreateProductDrawerProps) {
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const createProduct = useCreateProduct();

  const update = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    createProduct.reset();
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateForm(form);
    if ("errors" in validation) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});

    const input = validation.data;
    const payload: InsertTables<"products"> = {
      sku: input.sku,
      title: input.title,
      category: input.category,
      price_inr: input.price_inr,
      stock_count: input.stock_count,
      description: input.description || null,
    };

    createProduct.mutate(payload, { onSuccess: handleClose });
  };

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} labelledBy="create-product-title">
      <DrawerHeader eyebrow="Wellness Store" title="Create Product" titleId="create-product-title" onClose={handleClose}>
        <p className="text-xs text-text-secondary">Add a SKU to the wellness store catalog.</p>
      </DrawerHeader>

      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="product-sku" className={LABEL}>
                SKU
              </label>
              <input
                id="product-sku"
                type="text"
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
                placeholder="HX-OMEGA-60"
                className={cn(INPUT, "font-mono uppercase")}
              />
              {errors.sku && <p className={ERROR_TEXT}>{errors.sku}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="product-category" className={LABEL}>
                Category
              </label>
              <select
                id="product-category"
                value={form.category}
                onChange={(e) => update("category", e.target.value as ProductCategory)}
                className={INPUT}
              >
                {PRODUCT_CATEGORY_VALUES.map((category) => (
                  <option key={category} value={category}>
                    {PRODUCT_CATEGORY_META[category].label}
                  </option>
                ))}
              </select>
              {errors.category && <p className={ERROR_TEXT}>{errors.category}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="product-title" className={LABEL}>
              Title
            </label>
            <input
              id="product-title"
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Omega-3 Fish Oil 60 caps"
              className={INPUT}
            />
            {errors.title && <p className={ERROR_TEXT}>{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="product-price" className={LABEL}>
                Price (INR)
              </label>
              <input
                id="product-price"
                type="number"
                min={1}
                step="0.01"
                value={form.priceInr}
                onChange={(e) => update("priceInr", e.target.value)}
                placeholder="0.00"
                className={cn(INPUT, "font-mono")}
              />
              {errors.priceInr && <p className={ERROR_TEXT}>{errors.priceInr}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="product-stock" className={LABEL}>
                Stock Count
              </label>
              <input
                id="product-stock"
                type="number"
                min={0}
                step={1}
                value={form.stockCount}
                onChange={(e) => update("stockCount", e.target.value)}
                className={cn(INPUT, "font-mono")}
              />
              {errors.stockCount && <p className={ERROR_TEXT}>{errors.stockCount}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="product-description" className={LABEL}>
              Description
            </label>
            <textarea
              id="product-description"
              rows={5}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Ingredients, usage and FSSAI details."
              className={cn(INPUT, "resize-none")}
            />
          </div>

          {createProduct.isError && <div className={ERROR_BOX}>{createProduct.error.message}</div>}
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-aura-line">
          <button type="submit" disabled={createProduct.isPending} className={BTN_PRIMARY_BLOCK}>
            {createProduct.isPending ? "Creating..." : "Create Product"}
          </button>
          <button type="button" onClick={handleClose} className={BTN_SECONDARY_BLOCK}>
            Cancel
          </button>
        </div>
      </form>
    </Drawer>
  );
}
