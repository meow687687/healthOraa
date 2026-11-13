import { StyleSheet, Text, View } from 'react-native';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react-native';
import { COLORS, SPACE } from '../../../constants/theme';
import { Button, Card, EmptyState, ErrorBox, IconButton, LabelLine, monoStyle } from '../../components/primitives';
import { Sheet } from '../../components/Sheet';
import { formatPaise, rupeesToPaise } from '../../lib/money';
import { useCartStore } from './cartStore';
import { buildLines, summarise, type CartProduct } from './cartMath';

// Cart contents, quantities and totals. Checkout is opened by the shop screen, not from inside this sheet.
export function CartSheet({
  visible,
  products,
  onClose,
  onCheckout,
}: {
  visible: boolean;
  products: CartProduct[];
  onClose: () => void;
  onCheckout: () => void;
}) {
  const quantities = useCartStore((state) => state.quantities);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);

  const lines = buildLines(quantities, products);
  const totals = summarise(lines);
  // Items in the cart whose product is gone or inactive. They block checkout until removed.
  const unavailable = Object.keys(quantities).filter((id) => !products.some((product) => product.id === id));

  return (
    <Sheet visible={visible} title="Your cart" onClose={onClose}>
      {lines.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Add a product to see it here." />
      ) : null}

      {lines.map((line) => (
        <Card key={line.product.id}>
          <Text style={styles.title}>{line.product.title}</Text>
          <Text style={[styles.meta, monoStyle]}>{formatPaise(rupeesToPaise(Number(line.product.price_inr)))} each</Text>
          <View style={styles.stepper}>
            <IconButton
              label={`Decrease ${line.product.title}`}
              icon={Minus}
              onPress={() => setQuantity(line.product.id, line.quantity - 1, line.product.stock_count)}
            />
            <Text style={[styles.quantity, monoStyle]} accessibilityLabel={`Quantity ${line.quantity}`}>
              {line.quantity}
            </Text>
            <IconButton
              label={`Increase ${line.product.title}`}
              icon={Plus}
              disabled={line.quantity >= line.product.stock_count}
              onPress={() => setQuantity(line.product.id, line.quantity + 1, line.product.stock_count)}
            />
            <View style={styles.spacer} />
            <Text style={[styles.lineTotal, monoStyle]}>{formatPaise(line.linePaise)}</Text>
            <IconButton label={`Remove ${line.product.title}`} icon={Trash2} onPress={() => remove(line.product.id)} />
          </View>
        </Card>
      ))}

      {unavailable.length > 0 ? <ErrorBox message="Some items are no longer available. Remove them to check out." /> : null}

      {lines.length > 0 ? (
        <Card>
          <LabelLine label={`Subtotal (${totals.units} ${totals.units === 1 ? 'item' : 'items'})`} value={formatPaise(totals.subtotalPaise)} />
          <LabelLine label="Standard delivery" value="Free" />
          <LabelLine label="GST (18%)" value={formatPaise(totals.gstPaise)} />
          <LabelLine label="Total" value={formatPaise(totals.totalPaise)} strong />
        </Card>
      ) : null}

      {lines.length > 0 ? <Button label="Checkout" disabled={unavailable.length > 0} onPress={onCheckout} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  meta: { color: COLORS.textMuted, fontSize: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  quantity: { color: COLORS.textPrimary, fontSize: 16, minWidth: 28, textAlign: 'center' },
  spacer: { flex: 1 },
  lineTotal: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
});
