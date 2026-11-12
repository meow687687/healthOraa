import { z } from "zod";

// Shipping details for a wellness-shop order. Phone and PIN follow Indian formats.
export const checkoutOrderSchema = z.object({
  full_name: z
    .string({ error: "Enter the name the parcel should go to." })
    .trim()
    .min(3, "Full name must be at least 3 characters.")
    .max(100, "Full name must be 100 characters or fewer."),
  phone: z
    .string({ error: "Enter a mobile number." })
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number starting with 6, 7, 8 or 9."),
  pincode: z
    .string({ error: "Enter your PIN code." })
    .trim()
    .regex(/^\d{6}$/, "Enter a 6-digit PIN code."),
  address_line: z
    .string({ error: "Enter your street address." })
    .trim()
    .min(10, "Address must be at least 10 characters.")
    .max(250, "Address must be 250 characters or fewer."),
  city: z
    .string({ error: "Enter your city." })
    .trim()
    .min(2, "City must be at least 2 characters.")
    .max(60, "City must be 60 characters or fewer."),
  state: z
    .string({ error: "Enter your state." })
    .trim()
    .min(2, "State must be at least 2 characters.")
    .max(60, "State must be 60 characters or fewer."),
});

export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;

// Order statuses the admin portal can set. Restored from the admin portal's last build, which used these values.
export const ORDER_STATUS_VALUES = ["pending", "paid", "shipped", "delivered"] as const;

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES, { error: "Select a valid order status." }),
  tracking_number: z
    .string()
    .trim()
    .max(60, "Tracking number must be 60 characters or fewer.")
    .optional(),
});
