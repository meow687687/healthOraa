import { useState } from 'react';
import { startCheckout } from '../../lib/payments';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { Button, Card, ErrorBox, Skeleton, monoStyle } from '../../components/primitives';
import { Sheet } from '../../components/Sheet';
import { formatPaise, rupeesToPaise } from '../../lib/money';
import { HOME_CATEGORIES, useCategoryPrograms, useProgramCounts, type ProgramCategory } from './queries';

// Four programme categories. Each card shows how many programmes are open in it and lists them when tapped.
export function CategoryGrid() {
  const counts = useProgramCounts();
  const [selected, setSelected] = useState<ProgramCategory | null>(null);
  const selectedLabel = HOME_CATEGORIES.find((category) => category.value === selected)?.label ?? '';

  if (counts.isPending) return <Skeleton height={220} />;

  return (
    <View style={styles.grid}>
      {HOME_CATEGORIES.map((category) => {
        const count = counts.data?.[category.value] ?? 0;
        return (
          <Pressable
            key={category.value}
            accessibilityRole="button"
            accessibilityLabel={`${category.label}, ${count} programmes`}
            onPress={() => setSelected(category.value)}
            style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
          >
            <Card style={styles.tileCard}>
              <Text style={styles.tileTitle}>{category.label}</Text>
              <Text style={styles.tileBlurb}>{category.blurb}</Text>
              <View style={styles.tileFoot}>
                <Text style={[styles.count, monoStyle]}>
                  {count} {count === 1 ? 'programme' : 'programmes'}
                </Text>
                <ChevronRight color={COLORS.textMuted} size={16} />
              </View>
            </Card>
          </Pressable>
        );
      })}
      <CategorySheet category={selected} title={selectedLabel} onClose={() => setSelected(null)} />
    </View>
  );
}

function CategorySheet({
  category,
  title,
  onClose,
}: {
  category: ProgramCategory | null;
  title: string;
  onClose: () => void;
}) {
  const programs = useCategoryPrograms(category);
  return (
    <Sheet visible={category !== null} title={title} onClose={onClose}>
      {programs.isPending ? <Skeleton height={120} /> : null}
      {programs.isError ? <ErrorBox message={programs.error.message} /> : null}
      {programs.data?.length === 0 ? <Text style={styles.note}>No programmes are open in this category yet.</Text> : null}
      {programs.data?.map((program) => (
        <Card key={program.id}>
          <Text style={styles.tileTitle}>{program.title}</Text>
          {program.description ? <Text style={styles.tileBlurb}>{program.description}</Text> : null}
          <Text style={[styles.count, monoStyle]}>
            {program.duration_days} days · {formatPaise(rupeesToPaise(Number(program.price_inr)))}
          </Text>
          <EnrolButton programId={program.id} title={program.title} />
        </Card>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACE.md },
  tile: { borderRadius: RADIUS.xl },
  tileCard: { gap: SPACE.xs },
  pressed: { opacity: 0.85 },
  tileTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  tileBlurb: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.xs },
  count: { color: COLORS.textMuted, fontSize: 12 },
  note: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
});

// Opens a payment for the programme. The enrolment starts only when the webhook confirms the payment.
function EnrolButton({ programId, title }: { programId: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const onPress = async () => {
    setBusy(true);
    setFailure(null);
    setNote(null);
    const outcome = await startCheckout({ entityType: 'program', entityId: programId, description: title });
    setBusy(false);
    if (outcome.status === 'submitted') {
      setNote('Payment submitted. Your plan starts once Razorpay reports the payment as captured.');
    } else if (outcome.status === 'failed') {
      setFailure(outcome.message);
    }
  };
  return (
    <>
      {failure ? <ErrorBox message={failure} /> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Button label="Enrol and pay" busy={busy} onPress={() => void onPress()} />
    </>
  );
}
