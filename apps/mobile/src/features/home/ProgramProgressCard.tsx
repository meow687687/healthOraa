import { StyleSheet, Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { Card, EmptyState, Pill, Skeleton, monoStyle } from '../../components/primitives';
import { formatIstShortDate } from '../../lib/time';
import { useActiveEnrolment } from './queries';

const DAY_MS = 24 * 60 * 60 * 1000;

// Progress through the active programme, for example "Day 18 of 60".
export function ProgramProgressCard() {
  const enrolment = useActiveEnrolment();

  if (enrolment.isPending) return <Skeleton height={130} />;
  if (enrolment.isError) {
    return <EmptyState icon={Activity} title="Could not load your plan" description="Pull to refresh or try again later." />;
  }
  if (!enrolment.data) {
    return (
      <EmptyState
        icon={Activity}
        title="No active diet plan"
        description="Your programme progress will show here once you enrol in a plan."
      />
    );
  }

  const { programs, started_at, expires_at } = enrolment.data;
  const duration = programs?.duration_days ?? 60;
  const elapsedDays = Math.floor((Date.now() - new Date(started_at).getTime()) / DAY_MS) + 1;
  const day = Math.min(Math.max(elapsedDays, 1), duration);
  const percent = Math.round((day / duration) * 100);
  const endsOn = formatIstShortDate(expires_at);

  return (
    <Card>
      <View style={styles.row}>
        <Pill label="Active plan" tone="emerald" />
        <Text style={[styles.meta, monoStyle]}>Ends {endsOn}</Text>
      </View>
      <Text style={styles.title}>{programs?.title ?? 'Nutrition programme'}</Text>
      <Text style={[styles.progressLabel, monoStyle]} accessibilityLabel={`Day ${day} of ${duration}`}>
        Day {day} of {duration}
      </Text>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: COLORS.textMuted, fontSize: 12 },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginTop: SPACE.xs },
  progressLabel: { color: COLORS.textSecondary, fontSize: 13, marginTop: SPACE.xs },
  track: { height: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.s3, overflow: 'hidden', marginTop: SPACE.sm },
  fill: { height: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.accentBlue },
});
