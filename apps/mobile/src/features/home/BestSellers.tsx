import { FlatList, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { Button, EmptyState, ErrorBox, Pill, Skeleton, monoStyle } from '../../components/primitives';
import { formatPaise, rupeesToPaise } from '../../lib/money';
import { useCartStore } from '../shop/cartStore';
import { useBestSellers } from '../shop/queries';
import { CATEGORY_LABEL } from '../shop/ProductCard';
import { ShoppingBag } from 'lucide-react-native';

// Best-sellers from real orders. Products without sales are marked "Featured", not "Best seller".
export function BestSellers() {
  const products = useBestSellers();
  const quantities = useCartStore((state) => state.quantities);
  const add = useCartStore((state) => state.add);

  if (products.isPending) return <Skeleton height={170} />;
  if (products.isError) return <ErrorBox message={products.error.message} />;
  if (products.data.length === 0) {
    return <EmptyState icon={ShoppingBag} title="No products in stock" description="Products appear here when they are available." />;
  }

  return (
    <FlatList
      data={products.data}
      horizontal
      keyExtractor={(product) => product.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ width: SPACE.md }} />}
      renderItem={({ item: product }) => {
        const inCart = quantities[product.id] ?? 0;
        const atLimit = inCart >= product.stock_count;
        return (
          <View style={styles.card}>
            <Pill label={product.units_sold > 0 ? 'Best seller' : 'Featured'} tone={product.units_sold > 0 ? 'emerald' : 'neutral'} />
            <Text style={styles.title} numberOfLines={2}>
              {product.title}
            </Text>
            <Text style={styles.meta}>{CATEGORY_LABEL[product.category] ?? product.category}</Text>
            <Text style={[styles.price, monoStyle]}>{formatPaise(rupeesToPaise(Number(product.price_inr)))}</Text>
            <Button
              label={inCart > 0 ? `In cart (${inCart})` : 'Add to cart'}
              variant={inCart > 0 ? 'secondary' : 'primary'}
              disabled={atLimit}
              onPress={() => add(product.id, product.stock_count)}
            />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: SPACE.xs },
  card: {
    width: 190,
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.s1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
  },
  title: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  meta: { color: COLORS.textSecondary, fontSize: 12 },
  price: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
});
