import { CheckCircle2 } from "lucide-react";
import { BTN_PRIMARY, Badge, LABEL } from "@healthoraa/ui";
import { formatPaise } from "../../../lib/money";
import type { OrderConfirmation } from "../../../types/shop";

export function OrderSuccess({ confirmation, onDone }: { confirmation: OrderConfirmation; onDone: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="rounded-full border border-accent-emerald/30 bg-accent-emerald/10 p-2.5 text-accent-emerald">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold tracking-tight text-white">Order placed</h3>
          <Badge tone="amber">Payment is mocked. Not verified.</Badge>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-aura-line bg-aura-s2 p-5">
        <div>
          <p className={LABEL}>Tracking ID</p>
          <p className="font-mono text-lg font-bold tracking-wider text-white">{confirmation.trackingId}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={LABEL}>Items</p>
            <p className="font-mono text-sm text-text-primary">{confirmation.units}</p>
          </div>
          <div>
            <p className={LABEL}>Total incl. GST</p>
            <p className="font-mono text-sm text-text-primary">{formatPaise(confirmation.totalPaise)}</p>
          </div>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-text-secondary">
        Keep this ID for your records. A courier tracking number is added to your order when it ships.
      </p>

      <div className="flex justify-end border-t border-aura-line pt-5">
        <button type="button" onClick={onDone} className={BTN_PRIMARY}>
          Continue shopping
        </button>
      </div>
    </div>
  );
}
