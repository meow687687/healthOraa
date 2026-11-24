import { StyleSheet, Text, View } from 'react-native';
import { Leaf, Package, Pill as PillIcon, Scale, Sparkles, type LucideIcon } from 'lucide-react-native';
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

const CATEGORY_ART: Record<string, { Icon: LucideIcon; color: string }> = {
  supplements: { Icon: PillIcon, color: COLORS.accentBlue },
  ayurvedic: { Icon: Leaf, color: COLORS.accentEmerald },
  skincare: { Icon: Sparkles, color: COLORS.accentViolet },
  equipment: { Icon: Scale, color: COLORS.accentAmber },
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
  const art = CATEGORY_ART[product.category] ?? { Icon: Package, color: COLORS.textSecondary };
  const ArtIcon = art.Icon;
  return (
    <Card>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Illustrative ${CATEGORY_LABEL[product.category] ?? product.category} category art; not a product photo.`}
        style={styles.tile}
      >
        <ArtIcon color={art.color} size={34} strokeWidth={1.6} />
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
        accessibilityLabel={
          inCart > 0
            ? `Add another ${product.title} to cart; ${inCart} already in cart`
            : `Add ${product.title} to cart`
        }
        variant={inCart > 0 ? 'secondary' : 'primary'}
        disabled={soldOut || atLimit}
        onPress={() => onAdd(product)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    height: 120,
    backgroundColor: COLORS.s2,
    borderRadius: RADIUS.lg,
    gap: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  description: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  price: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
});
