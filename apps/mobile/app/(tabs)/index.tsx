import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { Screen, monoStyle } from '../../src/components/primitives';
import { BannerCarousel } from '../../src/features/home/BannerCarousel';
import { BestSellers } from '../../src/features/home/BestSellers';
import { CategoryGrid } from '../../src/features/home/CategoryGrid';
import { FeaturedPractitioners } from '../../src/features/home/FeaturedPractitioners';
import { ProgramProgressCard } from '../../src/features/home/ProgramProgressCard';
import { QuickActions } from '../../src/features/home/QuickActions';
import { useProfile } from '../../src/features/profile/queries';
import { COLORS, SPACE } from '../../constants/theme';

export default function HomeScreen() {
  const profile = useProfile();
  const firstName = profile.data?.full_name.split(' ')[0] ?? '';
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [programmesY, setProgrammesY] = useState(0);

  const scrollToProgrammes = () => {
    scrollRef.current?.scrollTo({ y: Math.max(programmesY - SPACE.lg, 0), animated: true });
  };

  return (
    <Screen>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, monoStyle]}>Healthoraa</Text>
          <Text style={styles.greeting}>{firstName ? `Hello, ${firstName}` : 'Welcome back'}</Text>
        </View>
        <QuickActions onDietPrograms={scrollToProgrammes} />
        <BannerCarousel />
        <Section title="Your plan">
          <ProgramProgressCard />
        </Section>
        <Section title="Featured doctors">
          <FeaturedPractitioners />
        </Section>
        <Section title="Best-sellers">
          <BestSellers />
        </Section>
        <View onLayout={(event) => setProgrammesY(event.nativeEvent.layout.y)}>
          <Section title="Diet programmes">
            <CategoryGrid />
          </Section>
        </View>
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
