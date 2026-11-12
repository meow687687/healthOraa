import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CheckoutOrderInput } from "@healthoraa/validation";
import { ERROR_TEXT, INPUT, LABEL, cn } from "@healthoraa/ui";

const Field = ({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className={LABEL}>
      {label}
    </label>
    {children}
    {error && <p className={ERROR_TEXT}>{error}</p>}
  </div>
);

// Shipping address. Validated by checkoutOrderSchema through the parent's form, and submitted with the form attribute.
export function ShippingForm({ form }: { form: UseFormReturn<CheckoutOrderInput> }) {
  const { register, formState } = form;
  const { errors } = formState;

  return (
    <fieldset className="space-y-5">
      <legend className={cn(LABEL, "mb-4")}>Shipping address</legend>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="ship-name" label="Full name" error={errors.full_name?.message}>
          <input id="ship-name" autoComplete="name" aria-invalid={Boolean(errors.full_name)} className={INPUT} {...register("full_name")} />
        </Field>
        <Field id="ship-phone" label="Mobile number" error={errors.phone?.message}>
          <input
            id="ship-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            aria-invalid={Boolean(errors.phone)}
            className={cn(INPUT, "font-mono tabular-nums")}
            {...register("phone")}
          />
        </Field>
      </div>

      <Field id="ship-address" label="Address" error={errors.address_line?.message}>
        <textarea
          id="ship-address"
          rows={2}
          autoComplete="street-address"
          aria-invalid={Boolean(errors.address_line)}
          className={cn(INPUT, "resize-none")}
          {...register("address_line")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="ship-city" label="City" error={errors.city?.message}>
          <input id="ship-city" autoComplete="address-level2" aria-invalid={Boolean(errors.city)} className={INPUT} {...register("city")} />
        </Field>
        <Field id="ship-state" label="State" error={errors.state?.message}>
          <input id="ship-state" autoComplete="address-level1" aria-invalid={Boolean(errors.state)} className={INPUT} {...register("state")} />
        </Field>
        <Field id="ship-pincode" label="PIN code" error={errors.pincode?.message}>
          <input
            id="ship-pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            aria-invalid={Boolean(errors.pincode)}
            className={cn(INPUT, "font-mono tabular-nums")}
            {...register("pincode")}
          />
        </Field>
      </div>
    </fieldset>
  );
}
