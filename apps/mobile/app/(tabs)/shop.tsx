import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShoppingBag, Package } from 'lucide-react-native';
import { COLORS, RADIUS, SPACE } from '../../constants/theme';
import { Button, EmptyState, ErrorBox, Heading, Screen, Skeleton, monoStyle } from '../../src/components/primitives';
import { CartSheet } from '../../src/features/shop/CartSheet';
import { CheckoutSheet } from '../../src/features/shop/CheckoutSheet';
import { buildLines, summarise, type CartLine } from '../../src/features/shop/cartMath';
import { useCartStore } from '../../src/features/shop/cartStore';
import { CATEGORY_LABEL, ProductCard, type ShopProductView } from '../../src/features/shop/ProductCard';
import { useProducts } from '../../src/features/shop/queries';

type Totals = ReturnType<typeof summarise>;

// Checkout works from the cart as it was when checkout opened, because placing the order empties the cart.
interface CheckoutSnapshot {
  lines: CartLine[];
  totals: Totals;
}

export default function ShopScreen() {
  const products = useProducts();
  const quantities = useCartStore((state) => state.quantities);
  const add = useCartStore((state) => state.add);
  const [category, setCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutSnapshot | null>(null);

  const list: ShopProductView[] = products.data ?? [];
  const shown = category ? list.filter((product) => product.category === category) : list;
  const cartUnits = Object.values(quantities).reduce((sum, count) => sum + count, 0);
  const categories = Object.keys(CATEGORY_LABEL);

  const openCheckout = () => {
    const lines = buildLines(quantities, list);
    setCheckout({ lines, totals: summarise(lines) });
    setCartOpen(false);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Heading eyebrow="Wellness" title="Shop" />
          <Button label={`Cart · ${cartUnits}`} variant="secondary" icon={ShoppingBag} onPress={() => setCartOpen(true)} />
        </View>

        <View style={styles.chips} accessibilityRole="tablist">
          <CategoryChip label="All" active={category === null} onPress={() => setCategory(null)} />
          {categories.map((value) => (
            <CategoryChip
              key={value}
              label={CATEGORY_LABEL[value] ?? value}
              active={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>

        {products.isPending ? <Skeleton height={260} /> : null}
        {products.isError ? <ErrorBox message={products.error.message} /> : null}
        {products.data && shown.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products in this category"
            description="Choose another category or check back soon."
            action={{ label: 'Show all products', onPress: () => setCategory(null) }}
          />
        ) : null}

        <View style={styles.grid}>
          {shown.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              inCart={quantities[product.id] ?? 0}
              onAdd={(item) => add(item.id, item.stock_count)}
            />
          ))}
        </View>
        <Text style={[styles.footnote, monoStyle]}>Free standard delivery across India. GST at 18% is added at checkout.</Text>
      </ScrollView>

      <CartSheet visible={cartOpen} products={list} onClose={() => setCartOpen(false)} onCheckout={openCheckout} />
      {checkout ? (
        <CheckoutSheet
          visible
          lines={checkout.lines}
          totals={checkout.totals}
          onClose={() => setCheckout(null)}
        />
      ) : null}
    </Screen>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.xl, gap: SPACE.lg, paddingBottom: SPACE.xxl },
  header: { gap: SPACE.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line2,
  },
  chipActive: { backgroundColor: COLORS.accentBlue, borderColor: COLORS.accentBlue },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: COLORS.textPrimary },
  grid: { gap: SPACE.md },
  footnote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
});
