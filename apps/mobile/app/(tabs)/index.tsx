import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen, monoStyle } from '../../src/components/primitives';
import { BannerCarousel } from '../../src/features/home/BannerCarousel';
import { CategoryGrid } from '../../src/features/home/CategoryGrid';
import { ProgramProgressCard } from '../../src/features/home/ProgramProgressCard';
import { useProfile } from '../../src/features/profile/queries';
import { COLORS, SPACE } from '../../constants/theme';

export default function HomeScreen() {
  const profile = useProfile();
  const firstName = profile.data?.full_name.split(' ')[0] ?? '';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, monoStyle]}>Healthoraa</Text>
          <Text style={styles.greeting}>{firstName ? `Hello, ${firstName}` : 'Welcome back'}</Text>
        </View>
        <BannerCarousel />
        <Section title="Your plan">
          <ProgramProgressCard />
        </Section>
        <Section title="Programmes">
          <CategoryGrid />
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.xl, gap: SPACE.xl, paddingBottom: SPACE.xxl },
  header: { gap: SPACE.xs },
  eyebrow: { color: COLORS.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  greeting: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '700' },
  section: { gap: SPACE.md },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
});
