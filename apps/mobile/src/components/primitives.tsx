import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS, RADIUS, SPACE, FONT_MONO } from '../../constants/theme';

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView edges={['top']} style={styles.screen}>{children}</SafeAreaView>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={styles.heading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

type Tone = 'blue' | 'emerald' | 'amber' | 'red' | 'neutral';
const TONE: Record<Tone, { color: string; background: string }> = {
  blue: { color: COLORS.accentBlue, background: 'rgba(43, 127, 255, 0.12)' },
  emerald: { color: COLORS.accentEmerald, background: 'rgba(16, 185, 129, 0.12)' },
  amber: { color: COLORS.accentAmber, background: 'rgba(255, 176, 32, 0.12)' },
  red: { color: COLORS.accentRed, background: 'rgba(255, 90, 110, 0.12)' },
  neutral: { color: COLORS.textSecondary, background: COLORS.s3 },
};

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const palette = TONE[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <Text style={[styles.pillText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  busy?: boolean;
  icon?: LucideIcon;
}

// Every button meets the 44 pt touch target and shows a spinner while its action is running.
export function Button({ label, variant = 'primary', busy = false, disabled, icon: Icon, ...rest }: ButtonProps) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variantStyle[variant],
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.inactive : null,
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={COLORS.textPrimary} />
      ) : (
        <>
          {Icon ? <Icon color={COLORS.textPrimary} size={16} /> : null}
          <Text style={styles.buttonText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// Icon-only control with a 44 pt target and an accessible name.
export function IconButton({
  label,
  icon: Icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, disabled ? styles.inactive : null, pressed && !disabled ? styles.pressed : null]}
    >
      <Icon color={COLORS.textPrimary} size={18} />
    </Pressable>
  );
}

export function LabelLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, monoStyle, strong ? styles.lineStrong : null]}>{value}</Text>
    </View>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Skeleton({ height }: { height: number }) {
  return <View accessibilityLabel="Loading" style={[styles.skeleton, { height }]} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Card style={styles.empty}>
      <View style={styles.emptyBadge}>
        <Icon color={COLORS.textSecondary} size={20} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </Card>
  );
}

export const monoStyle = { fontFamily: FONT_MONO };

const variantStyle: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: COLORS.accentBlue },
  secondary: { backgroundColor: COLORS.s3, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line2 },
  danger: { backgroundColor: COLORS.accentRed },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  card: {
    backgroundColor: COLORS.s1,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  heading: { gap: SPACE.xs, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm },
  eyebrow: { color: COLORS.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontFamily: FONT_MONO },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '700' },
  pill: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '600', fontFamily: FONT_MONO },
  button: {
    minHeight: 44,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  buttonText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  inactive: { opacity: 0.5 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.s3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line2,
  },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, paddingVertical: 4 },
  lineLabel: { color: COLORS.textSecondary, fontSize: 14 },
  lineValue: { color: COLORS.textPrimary, fontSize: 14, textAlign: 'right', flexShrink: 1 },
  lineStrong: { fontSize: 18, fontWeight: '700' },
  errorBox: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 90, 110, 0.4)',
    backgroundColor: 'rgba(255, 90, 110, 0.1)',
    padding: SPACE.md,
  },
  errorText: { color: COLORS.accentRed, fontSize: 13 },
  skeleton: { borderRadius: RADIUS.xl, backgroundColor: COLORS.s2 },
  empty: { alignItems: 'center', paddingVertical: SPACE.xxl, gap: SPACE.sm },
  emptyBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
  },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptyDescription: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' },
});
