import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { useAuth } from '../../auth/AuthProvider';
import { Button, Card, ErrorBox, Pill, Skeleton, monoStyle } from '../../components/primitives';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useNow } from '../../hooks/useNow';
import { daysUntil } from '../../lib/time';
import { useConsultationMessages, useSendConsultationMessage } from './queries';

export interface ChatTarget {
  consultationId: string;
  doctorId: string;
  doctorName: string;
  followupExpiresAt: string | null;
}

export function ChatSheet({
  target,
  onClose,
  onBookAgain,
}: {
  target: ChatTarget | null;
  onClose: () => void;
  onBookAgain: (doctorId: string) => void;
}) {
  return (
    <Sheet visible={target !== null} title={target ? `Follow-up with ${target.doctorName}` : ''} onClose={onClose}>
      {target ? <ChatBody target={target} onBookAgain={onBookAgain} /> : null}
    </Sheet>
  );
}

function ChatBody({ target, onBookAgain }: { target: ChatTarget; onBookAgain: (doctorId: string) => void }) {
  const { session } = useAuth();
  const now = useNow();
  const messages = useConsultationMessages(target.consultationId);
  const send = useSendConsultationMessage(target.consultationId);
  const [draft, setDraft] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  // The 7-day window ends at followup_expires_at. The database enforces the same rule on every insert.
  const expired = target.followupExpiresAt === null || new Date(target.followupExpiresAt).getTime() <= now.getTime();

  const onSend = async () => {
    setFailure(null);
    try {
      await send.mutateAsync(draft);
      setDraft('');
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Message not sent. Try again.');
    }
  };

  return (
    <>
      {expired ? (
        <Card style={styles.locked}>
          <Pill label="Chat closed" tone="red" />
          <Text style={styles.lockedTitle}>Consultation Expired — Book Again</Text>
          <Text style={styles.lockedBody}>
            The 7-day follow-up for this consultation has ended. Book a new consultation for further clinical questions.
          </Text>
          <Button label="Book Again" onPress={() => onBookAgain(target.doctorId)} />
        </Card>
      ) : (
        <Pill label={`${daysUntil(target.followupExpiresAt ?? '', now)} days left in follow-up`} tone="emerald" />
      )}

      {messages.isPending ? <Skeleton height={140} /> : null}
      {messages.isError ? <ErrorBox message={messages.error.message} /> : null}
      {messages.data?.length === 0 ? (
        <Text style={styles.empty}>No messages yet. Ask about your prescription, dosage or lab tests.</Text>
      ) : null}
      {messages.data?.map((message) => {
        const mine = message.sender_id === session?.user.id;
        return (
          <View key={message.id} style={[styles.bubbleRow, mine ? styles.rowEnd : styles.rowStart]}>
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={styles.bubbleText}>{message.content}</Text>
            </View>
          </View>
        );
      })}

      {expired ? null : (
        <View style={styles.composer}>
          {failure ? <ErrorBox message={failure} /> : null}
          <TextField
            label="Message"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            placeholder="Write your question"
          />
          <Text style={[styles.count, monoStyle]}>{draft.length}/1000</Text>
          <Button label="Send message" busy={send.isPending} onPress={() => void onSend()} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  locked: { gap: SPACE.sm, borderColor: 'rgba(255, 90, 110, 0.4)' },
  lockedTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  lockedBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  empty: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: SPACE.lg },
  bubbleRow: { flexDirection: 'row' },
  rowEnd: { justifyContent: 'flex-end' },
  rowStart: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: RADIUS.lg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  mine: { backgroundColor: COLORS.accentBlue },
  theirs: { backgroundColor: COLORS.s3 },
  bubbleText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  composer: { gap: SPACE.sm },
  count: { color: COLORS.textMuted, fontSize: 11, textAlign: 'right' },
});
