import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FileText, ShieldAlert, LogOut, Trash2 } from 'lucide-react-native';
import { COLORS, RADIUS, SPACE } from '../../constants/theme';
import { GRIEVANCE_OFFICER, MEDICAL_DISCLAIMERS } from '../../constants/legal';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Card, EmptyState, ErrorBox, Heading, Pill, Screen, Skeleton, monoStyle } from '../../src/components/primitives';
import { formatIstDate } from '../../src/lib/time';
import { useDeleteAccount, useHealthLocker, openLockerDocument, useProfile } from '../../src/features/profile/queries';

const DELETE_MESSAGE =
  'Your login, name, phone number and any health records you uploaded are deleted. Consultation, prescription and order records stay on file without your name, because clinical and tax rules require them. This cannot be undone.';

export default function ProfileScreen() {
  const { session, signOut, setNotice } = useAuth();
  const profile = useProfile();
  const locker = useHealthLocker();
  const deleteAccount = useDeleteAccount();
  const [lockerError, setLockerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const openDocument = async (filePath: string | null) => {
    setLockerError(null);
    try {
      await openLockerDocument(filePath);
    } catch (error) {
      setLockerError(error instanceof Error ? error.message : 'The document could not be opened.');
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete account and data?', DELETE_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteAccount.mutateAsync();
              // The login is gone on the server. Clear this device's copy and show the sign-in screen with a notice.
              setNotice('Your account and personal data have been deleted.');
              await signOut();
            } catch (error) {
              setDeleteError(error instanceof Error ? error.message : 'Account deletion failed. Try again.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Heading eyebrow="Account" title="Profile" />

        <Card>
          <Text style={styles.name}>{profile.data?.full_name ?? 'Patient'}</Text>
          <Text style={[styles.meta, monoStyle]}>{session?.user.email}</Text>
          {profile.data?.phone ? <Text style={[styles.meta, monoStyle]}>{profile.data.phone}</Text> : null}
          <Pill label="Patient account" tone="blue" />
        </Card>

        <Section title="Health locker">
          {lockerError ? <ErrorBox message={lockerError} /> : null}
          {locker.isPending ? <Skeleton height={120} /> : null}
          {locker.isError ? <ErrorBox message={locker.error.message} /> : null}
          {locker.data?.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No records yet"
              description="Lab reports, scans and prescriptions appear here once they are added to your locker."
            />
          ) : null}
          {locker.data?.map((document) => (
            <Pressable
              key={document.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${document.title}`}
              onPress={() => void openDocument(document.file_path)}
              style={({ pressed }) => [pressed ? styles.pressed : null]}
            >
              <Card>
                <View style={styles.docRow}>
                  <FileText color={COLORS.textSecondary} size={18} />
                  <View style={styles.docText}>
                    <Text style={styles.docTitle}>{document.title}</Text>
                    <Text style={[styles.meta, monoStyle]}>
                      {document.document_date ? formatIstDate(`${document.document_date}T00:00:00+05:30`) : 'Date not recorded'}
                    </Text>
                  </View>
                  <Pill label={document.category.replace(/_/g, ' ')} />
                </View>
              </Card>
            </Pressable>
          ))}
        </Section>

        <Section title="Medical disclaimers">
          <Card>
            {MEDICAL_DISCLAIMERS.map((line) => (
              <Text key={line} style={styles.body}>
                • {line}
              </Text>
            ))}
          </Card>
        </Section>

        <Section title="Grievance officer">
          <Card>
            <View style={styles.docRow}>
              <ShieldAlert color={COLORS.textSecondary} size={18} />
              <Text style={styles.body}>{GRIEVANCE_OFFICER.name}</Text>
            </View>
            <Text style={[styles.meta, monoStyle]}>{GRIEVANCE_OFFICER.email}</Text>
            <Text style={styles.body}>{GRIEVANCE_OFFICER.responseWindow}</Text>
          </Card>
        </Section>

        <Button label="Sign out" variant="secondary" icon={LogOut} busy={signingOut} onPress={() => {
          setSigningOut(true);
          void signOut().finally(() => setSigningOut(false));
        }} />

        {deleteError ? <ErrorBox message={deleteError} /> : null}
        <Button label="Delete Account & Data" variant="danger" icon={Trash2} busy={deleteAccount.isPending} onPress={confirmDelete} />
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
  section: { gap: SPACE.md },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  name: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  meta: { color: COLORS.textMuted, fontSize: 12 },
  body: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  docText: { flex: 1, gap: 2 },
  docTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85, borderRadius: RADIUS.xl },
});
