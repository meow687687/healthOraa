import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { checkoutOrderSchema, type CheckoutOrderInput } from '@healthoraa/validation';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACE } from '../../../constants/theme';
import { Button, Card, ErrorBox, LabelLine, Pill } from '../../components/primitives';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { formatPaise } from '../../lib/money';
import { startCheckout } from '../../lib/payments';
import { useCartStore } from './cartStore';
import type { CartLine } from './cartMath';
import { usePlaceOrder } from './queries';

interface Totals {
  units: number;
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
}

// Shipping details, then the order is placed as pending. Payment is confirmed on the server.
export function CheckoutSheet({
  visible,
  lines,
  totals,
  onClose,
}: {
  visible: boolean;
  lines: CartLine[];
  totals: Totals;
  onClose: () => void;
}) {
  const [placed, setPlaced] = useState<{ orderId: string } | null>(null);
  return (
    <Sheet
      visible={visible}
      title={placed ? 'Order placed' : 'Checkout'}
      onClose={() => {
        setPlaced(null);
        onClose();
      }}
    >
      {placed ? (
        <PlacedOrder orderId={placed.orderId} totalPaise={totals.totalPaise} onDone={() => {
          setPlaced(null);
          onClose();
        }} />
      ) : (
        <ShippingForm
          lines={lines}
          totals={totals}
          onPlaced={(orderId) => {
            useCartStore.getState().clear();
            setPlaced({ orderId });
          }}
        />
      )}
    </Sheet>
  );
}

function ShippingForm({
  lines,
  totals,
  onPlaced,
}: {
  lines: CartLine[];
  totals: Totals;
  onPlaced: (orderId: string) => void;
}) {
  const place = usePlaceOrder();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<CheckoutOrderInput>({
    resolver: zodResolver(checkoutOrderSchema),
    mode: 'onTouched',
    defaultValues: { full_name: '', phone: '', pincode: '', address_line: '', city: '', state: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = async (values: CheckoutOrderInput) => {
    setFailure(null);
    // Stock is checked on the device at placement time. The database does not reserve stock yet.
    const short = lines.find((line) => line.quantity > line.product.stock_count);
    if (short) {
      setFailure(`Only ${short.product.stock_count} of ${short.product.title} left. Lower the quantity in your cart.`);
      return;
    }
    try {
      const orderId = await place.mutateAsync({
        items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        checkout: values,
      });
      onPlaced(orderId);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The order could not be placed. Try again.');
    }
  };

  return (
    <>
      {failure ? <ErrorBox message={failure} /> : null}
      <Card>
        <LabelLine label="Total incl. GST" value={formatPaise(totals.totalPaise)} strong />
      </Card>
      <Controller
        control={form.control}
        name="full_name"
        render={({ field }) => (
          <TextField label="Full name" autoComplete="name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.full_name?.message} />
        )}
      />
      <Controller
        control={form.control}
        name="phone"
        render={({ field }) => (
          <TextField label="Mobile number" keyboardType="phone-pad" maxLength={10} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.phone?.message} />
        )}
      />
      <Controller
        control={form.control}
        name="address_line"
        render={({ field }) => (
          <TextField label="Address" multiline value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.address_line?.message} />
        )}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <Controller
            control={form.control}
            name="city"
            render={({ field }) => (
              <TextField label="City" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.city?.message} />
            )}
          />
        </View>
        <View style={styles.half}>
          <Controller
            control={form.control}
            name="pincode"
            render={({ field }) => (
              <TextField label="PIN code" keyboardType="number-pad" maxLength={6} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.pincode?.message} />
            )}
          />
        </View>
      </View>
      <Controller
        control={form.control}
        name="state"
        render={({ field }) => (
          <TextField label="State" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.state?.message} />
        )}
      />
      <Button label="Place order" busy={isSubmitting || place.isPending} onPress={() => void form.handleSubmit(onSubmit)()} />
    </>
  );
}

function PlacedOrder({ orderId, totalPaise, onDone }: { orderId: string; totalPaise: number; onDone: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const reference = `HX-${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  const onPay = async () => {
    setFailure(null);
    const outcome = await startCheckout({ entityType: 'shop_order', entityId: orderId, description: 'Wellness order' });
    if (outcome.status === 'submitted') {
      setNote('Payment submitted. The order moves forward once Razorpay reports the payment as captured.');
    } else if (outcome.status === 'cancelled') {
      setNote('Payment cancelled. The order stays pending until it is paid.');
    } else if (outcome.status === 'failed') {
      setFailure(outcome.message);
    }
  };

  return (
    <>
      <Card>
        <Pill label="Pending payment" tone="amber" />
        <LabelLine label="Reference" value={reference} />
        <LabelLine label="Total incl. GST" value={formatPaise(totalPaise)} strong />
      </Card>
      {failure ? <ErrorBox message={failure} /> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Button label={`Pay ${formatPaise(totalPaise)} with Razorpay`} onPress={() => void onPay()} />
      <Button label="Done" variant="secondary" onPress={onDone} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.md },
  half: { flex: 1 },
  note: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
});
