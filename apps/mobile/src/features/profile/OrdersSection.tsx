import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Package } from 'lucide-react-native';
import { COLORS, SPACE } from '../../../constants/theme';
import { Button, Card, EmptyState, ErrorBox, LabelLine, Pill, Skeleton, monoStyle } from '../../components/primitives';
import { formatPaise, rupeesToPaise } from '../../lib/money';
import { startCheckout } from '../../lib/payments';
import { formatIstDateTime } from '../../lib/time';
import { useOrders } from './queries';

const STEPS = ['pending', 'paid', 'shipped', 'delivered'] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  pending: 'Placed',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

// Order history with each line's product, quantity and price, and where the order is in its journey.
export function OrdersSection() {
  const orders = useOrders();
  if (orders.isPending) return <Skeleton height={140} />;
  if (orders.isError) return <ErrorBox message={orders.error.message} />;
  if (orders.data.length === 0) {
    return <EmptyState icon={Package} title="No orders yet" description="Wellness orders appear here with their items and status." />;
  }
  return (
    <View style={styles.list}>
      {orders.data.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </View>
  );
}

type OrderRow = NonNullable<ReturnType<typeof useOrders>['data']>[number];

function OrderCard({ order }: { order: OrderRow }) {
  const reference = `HX-${order.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const cancelled = order.status === 'cancelled';
  const reached = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  return (
    <Card>
      <View style={styles.head}>
        <Text style={[styles.reference, monoStyle]}>{reference}</Text>
        <Pill label={cancelled ? 'Cancelled' : order.status} tone={cancelled ? 'red' : order.status === 'pending' ? 'amber' : 'emerald'} />
      </View>
      <Text style={[styles.meta, monoStyle]}>{formatIstDateTime(order.created_at)} IST</Text>

      {cancelled ? null : (
        <View style={styles.steps} accessibilityLabel={`Order status: ${order.status}`}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.dot, index <= reached ? styles.dotOn : null]} />
              <Text style={[styles.stepLabel, index <= reached ? styles.stepLabelOn : null]}>{STEP_LABEL[step]}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.items}>
        {order.order_items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.products?.title ?? 'Product'} × {item.quantity}
            </Text>
            <Text style={[styles.itemPrice, monoStyle]}>
              {formatPaise(rupeesToPaise(Number(item.unit_price_inr) * item.quantity))}
            </Text>
          </View>
        ))}
      </View>

      <LabelLine label="Total incl. GST" value={formatPaise(rupeesToPaise(Number(order.total_amount_inr)))} strong />
      {order.tracking_number ? <LabelLine label="Tracking" value={order.tracking_number} /> : null}
      {order.status === 'pending' ? <PayOrderButton orderId={order.id} /> : null}
    </Card>
  );
}

function PayOrderButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const onPress = async () => {
    setBusy(true);
    setFailure(null);
    const outcome = await startCheckout({ entityType: 'shop_order', entityId: orderId, description: 'Wellness order' });
    setBusy(false);
    if (outcome.status === 'failed') setFailure(outcome.message);
  };
  return (
    <>
      {failure ? <ErrorBox message={failure} /> : null}
      <Button label="Pay now" busy={busy} onPress={() => void onPress()} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reference: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  meta: { color: COLORS.textMuted, fontSize: 12 },
  steps: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.xs },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.s3 },
  dotOn: { backgroundColor: COLORS.accentBlue },
  stepLabel: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center' },
  stepLabelOn: { color: COLORS.textPrimary },
  items: { gap: SPACE.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, paddingTop: SPACE.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md },
  itemName: { color: COLORS.textSecondary, fontSize: 13, flexShrink: 1 },
  itemPrice: { color: COLORS.textSecondary, fontSize: 13 },
});
