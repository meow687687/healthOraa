import { useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { Skeleton } from '../../components/primitives';
import { useBanners } from './queries';

type Banner = { id: string; title: string; image_url: string; display_order: number };

const CARD_WIDTH = Dimensions.get('window').width - SPACE.xl * 2;

// Promotional hero cards from the admin portal. Swipe to page through them.
export function BannerCarousel() {
  const banners = useBanners();
  const [index, setIndex] = useState(0);

  if (banners.isPending) return <Skeleton height={160} />;
  if (banners.isError || banners.data.length === 0) return null;

  const renderBanner = ({ item }: ListRenderItemInfo<Banner>) => (
    <View style={styles.card} accessibilityLabel={item.title}>
      <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
      <View style={styles.overlay}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <FlatList
        data={banners.data}
        keyExtractor={(item) => item.id}
        renderItem={renderBanner}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + SPACE.md}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ width: SPACE.md }} />}
        onMomentumScrollEnd={(event) => {
          setIndex(Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + SPACE.md)));
        }}
      />
      {banners.data.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Banner ${index + 1} of ${banners.data.length}`}>
          {banners.data.map((banner, dot) => (
            <View key={banner.id} style={[styles.dot, dot === index ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  list: { paddingHorizontal: 0 },
  card: {
    width: CARD_WIDTH,
    height: 160,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.s2,
  },
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACE.lg,
    backgroundColor: 'rgba(9, 10, 15, 0.55)',
  },
  title: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: SPACE.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.line2 },
  dotActive: { backgroundColor: COLORS.accentBlue, width: 18 },
});
