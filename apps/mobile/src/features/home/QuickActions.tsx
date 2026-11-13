import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Apple, FolderLock, ShoppingBag, Stethoscope, type LucideIcon } from 'lucide-react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';

interface Action {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

// Four shortcuts. "Diet Programs" scrolls to the programme list on this screen.
export function QuickActions({ onDietPrograms }: { onDietPrograms: () => void }) {
  const actions: Action[] = [
    { label: 'Book Doctor', icon: Stethoscope, onPress: () => router.navigate('/(tabs)/consultations') },
    { label: 'Diet Programs', icon: Apple, onPress: onDietPrograms },
    { label: 'Wellness Shop', icon: ShoppingBag, onPress: () => router.navigate('/(tabs)/shop') },
    { label: 'Health Locker', icon: FolderLock, onPress: () => router.navigate('/(tabs)/profile') },
  ];
  return (
    <View style={styles.grid}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
          >
            <View style={styles.badge}>
              <Icon color={COLORS.textPrimary} size={18} />
            </View>
            <Text style={styles.label}>{action.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  tile: {
    width: '48%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.s1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
  },
  pressed: { opacity: 0.85 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.s3,
  },
  label: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
