import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { Button, Card, Pill, monoStyle } from '../../components/primitives';
import { formatPaise, rupeesToPaise } from '../../lib/money';

export const LOW_STOCK = 5;

export const CATEGORY_LABEL: Record<string, string> = {
  supplements: 'Supplements',
  ayurvedic: 'Ayurvedic',
  skincare: 'Skincare',
  equipment: 'Equipment',
};

export interface ShopProductView {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price_inr: number;
  stock_count: number;
}

export function ProductCard({
  product,
  inCart,
  onAdd,
}: {
  product: ShopProductView;
  inCart: number;
  onAdd: (product: ShopProductView) => void;
}) {
  const soldOut = product.stock_count <= 0;
  const atLimit = inCart >= product.stock_count;
  return (
    <Card>
      <View style={styles.tile} accessibilityElementsHidden>
        <Text style={styles.tileLetter}>{product.title.charAt(0)}</Text>
      </View>
      <View style={styles.row}>
        <Pill label={CATEGORY_LABEL[product.category] ?? product.category} />
        {soldOut ? <Pill label="Out of stock" tone="red" /> : null}
        {!soldOut && product.stock_count <= LOW_STOCK ? <Pill label={`Only ${product.stock_count} left`} tone="amber" /> : null}
      </View>
      <Text style={styles.title}>{product.title}</Text>
      {product.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {product.description}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Text style={[styles.price, monoStyle]}>{formatPaise(rupeesToPaise(Number(product.price_inr)))}</Text>
      </View>
      <Button
        label={inCart > 0 ? `In cart (${inCart})` : 'Add to cart'}
        variant={inCart > 0 ? 'secondary' : 'primary'}
        disabled={soldOut || atLimit}
        onPress={() => onAdd(product)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    height: 96,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLetter: { color: COLORS.textSecondary, fontSize: 32, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  description: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  price: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
});
