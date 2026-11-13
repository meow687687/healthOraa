import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { useAuth } from '../../auth/AuthProvider';
import { Button, Card, ErrorBox, Pill, Skeleton, monoStyle } from '../../components/primitives';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useNow } from '../../hooks/useNow';
import { DOCUMENT_ACCEPTED_TYPES, DOCUMENT_MAX_BYTES } from '@healthoraa/validation';
import { daysUntil } from '../../lib/time';
import { uploadRecordFile, signedRecordUrl, safeFileName } from '../../lib/uploads';
import { useProgramMessages, useSendProgramMessage, type ProgramMessageRow } from './programChat';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'react-native';

export interface ProgramChatTarget {
  enrolmentId: string;
  title: string;
  expiresAt: string;
}

// The 60-day dietitian chat. Text and meal photos. Locked when the programme ends.
export function ProgramChatSheet({ target, onClose }: { target: ProgramChatTarget | null; onClose: () => void }) {
  return (
    <Sheet visible={target !== null} title={target ? `Chat · ${target.title}` : ''} onClose={onClose}>
      {target ? <ProgramChatBody target={target} /> : null}
    </Sheet>
  );
}

function ProgramChatBody({ target }: { target: ProgramChatTarget }) {
  const { session } = useAuth();
  const now = useNow();
  const messages = useProgramMessages(target.enrolmentId);
  const send = useSendProgramMessage(target.enrolmentId);
  const [draft, setDraft] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  const expired = new Date(target.expiresAt).getTime() <= now.getTime();
  const userId = session?.user.id;

  const sendText = async () => {
    setFailure(null);
    try {
      await send.mutateAsync({ text: draft, attachmentPath: null });
      setDraft('');
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Message not sent. Try again.');
    }
  };

  const attachMealPhoto = async () => {
    setFailure(null);
    if (!userId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFailure('Allow photo access to attach a meal photo.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0];
    if ((asset.fileSize ?? 0) > DOCUMENT_MAX_BYTES) {
      setFailure('That photo is larger than 10 MB. Choose a smaller one.');
      return;
    }
    setAttaching(true);
    try {
      const extension = (asset.mimeType ?? 'image/jpeg').endsWith('png') ? 'png' : 'jpg';
      const path = `${userId}/meals/${Date.now()}-${safeFileName(asset.fileName ?? `meal.${extension}`)}`;
      await uploadRecordFile(path, asset.uri, asset.mimeType ?? 'image/jpeg');
      await send.mutateAsync({ text: draft, attachmentPath: path });
      setDraft('');
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The meal photo could not be sent.');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <>
      {expired ? (
        <Card style={styles.locked}>
          <Pill label="Chat closed" tone="red" />
          <Text style={styles.lockedBody}>
            This programme has ended. Your past messages stay here for reference.
          </Text>
        </Card>
      ) : (
        <Pill label={`${daysUntil(target.expiresAt, now)} days left in this programme`} tone="emerald" />
      )}

      {messages.isPending ? <Skeleton height={140} /> : null}
      {messages.isError ? <ErrorBox message={messages.error.message} /> : null}
      {messages.data?.length === 0 ? (
        <Text style={styles.empty}>No messages yet. Share a question or a meal photo with your dietitian.</Text>
      ) : null}
      {messages.data?.map((message) => (
        <MessageBubble key={message.id} message={message} mine={message.sender_id === userId} />
      ))}

      {expired ? null : (
        <View style={styles.composer}>
          {failure ? <ErrorBox message={failure} /> : null}
          <TextField
            label="Message"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
            placeholder="Write a message or add a caption"
          />
          <View style={styles.actions}>
            <View style={styles.grow}>
              <Button label="Send" busy={send.isPending && !attaching} onPress={() => void sendText()} />
            </View>
            <View style={styles.grow}>
              <Button label="Meal photo" variant="secondary" icon={Camera} busy={attaching} onPress={() => void attachMealPhoto()} />
            </View>
          </View>
        </View>
      )}
    </>
  );
}

function MessageBubble({ message, mine }: { message: ProgramMessageRow; mine: boolean }) {
  return (
    <View style={[styles.row, mine ? styles.rowEnd : styles.rowStart]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {message.attachment_url ? <MealPhoto path={message.attachment_url} /> : null}
        {message.content ? <Text style={styles.bubbleText}>{message.content}</Text> : null}
        {message.is_meal_photo ? <Text style={[styles.tag, monoStyle]}>Meal photo</Text> : null}
      </View>
    </View>
  );
}

// Each photo gets a fresh link that expires after 60 seconds.
function MealPhoto({ path }: { path: string }) {
  const link = useQuery({
    queryKey: ['signed-record', path],
    queryFn: () => signedRecordUrl(path),
    staleTime: 50_000,
    gcTime: 0,
  });
  if (link.isPending) return <Skeleton height={160} />;
  if (link.isError) return <Text style={styles.tag}>Photo unavailable</Text>;
  return <Image source={{ uri: link.data }} style={styles.photo} resizeMode="cover" accessibilityLabel="Meal photo" />;
}

const styles = StyleSheet.create({
  locked: { gap: SPACE.sm, borderColor: 'rgba(255, 90, 110, 0.4)' },
  lockedBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
  empty: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: SPACE.lg },
  row: { flexDirection: 'row' },
  rowEnd: { justifyContent: 'flex-end' },
  rowStart: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: RADIUS.lg, padding: SPACE.sm, gap: SPACE.xs },
  mine: { backgroundColor: COLORS.accentBlue },
  theirs: { backgroundColor: COLORS.s3 },
  bubbleText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20, paddingHorizontal: SPACE.xs },
  tag: { color: COLORS.textSecondary, fontSize: 11, paddingHorizontal: SPACE.xs },
  photo: { width: 220, height: 160, borderRadius: RADIUS.md },
  composer: { gap: SPACE.sm },
  actions: { flexDirection: 'row', gap: SPACE.sm },
  grow: { flex: 1 },
});
