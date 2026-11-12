// Amounts are kept in paise (integers) so GST never picks up floating-point drift.
export const GST_RATE = 0.18;

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

export const gstOn = (paise: number): number => Math.round(paise * GST_RATE);

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatPaise = (paise: number): string => inrFormatter.format(paise / 100);
