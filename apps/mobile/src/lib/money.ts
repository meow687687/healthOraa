// Money is handled in paise (integers) to avoid floating-point drift. GST is 18% on the taxable amount.
export const GST_RATE = 0.18;

export const rupeesToPaise = (rupees: number): number => Math.round(rupees * 100);

export const gstOn = (paise: number): number => Math.round(paise * GST_RATE);

// Indian digit grouping (12,34,567). Written by hand so it does not depend on the device's Intl support.
const groupIndian = (digits: string): string => {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${last3}`;
};

export const formatPaise = (paise: number): string => {
  const sign = paise < 0 ? '-' : '';
  const absolute = Math.abs(paise);
  const rupees = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}₹${groupIndian(String(rupees))}.${fraction}`;
};
