import { ShoppingBag } from "lucide-react";
import { BTN_PRIMARY } from "@healthoraa/ui";
import { formatPaise } from "../../lib/money";

// Fixed above the patient nav. Shows the unit count and the subtotal, and opens the cart.
export function CartPill({ units, subtotalPaise, onOpen }: { units: number; subtotalPaise: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${BTN_PRIMARY} fixed bottom-24 left-1/2 z-30 -translate-x-1/2 shadow-aura-elevated`}
    >
      <ShoppingBag className="h-4 w-4" />
      <span>
        {units} {units === 1 ? "Item" : "Items"} • {formatPaise(subtotalPaise)}
      </span>
    </button>
  );
}
