import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as DocumentPicker from 'expo-document-picker';
import { StyleSheet, Pressable, Text, View } from 'react-native';
import { DOCUMENT_ACCEPTED_TYPES, DOCUMENT_CATEGORIES, DOCUMENT_MAX_BYTES, localTodayKey, uploadDocumentSchema, type UploadDocumentInput } from '@healthoraa/validation';
import { COLORS, RADIUS, SPACE } from '../../../constants/theme';
import { Button, Card, ErrorBox, monoStyle } from '../../components/primitives';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useUploadLockerDocument, type LockerUpload } from './queries';

const CATEGORY_LABEL: Record<(typeof DOCUMENT_CATEGORIES)[number], string> = {
  blood_panel: 'Blood panel',
  imaging_radiology: 'Imaging',
  prescription: 'Prescription',
  discharge_summary: 'Discharge summary',
  other: 'Other',
};

interface PickedFile {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string;
}

// Picks a PDF or image, then records it in the Health Locker with a title, category and the date on the document.
export function UploadDocumentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Upload a report" onClose={onClose}>
      {visible ? <UploadForm onDone={onClose} /> : null}
    </Sheet>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const upload = useUploadLockerDocument();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<UploadDocumentInput>({
    resolver: zodResolver(uploadDocumentSchema),
    mode: 'onTouched',
    defaultValues: { title: '', category: 'other', document_date: localTodayKey() },
  });
  const { errors, isSubmitting } = form.formState;

  const pickFile = async () => {
    setFileError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [...DOCUMENT_ACCEPTED_TYPES],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0];
    const mimeType = asset.mimeType ?? '';
    if (!(DOCUMENT_ACCEPTED_TYPES as readonly string[]).includes(mimeType)) {
      setFileError('Choose a PDF, JPEG or PNG file.');
      return;
    }
    if ((asset.size ?? 0) > DOCUMENT_MAX_BYTES) {
      setFileError('That file is larger than 10 MB.');
      return;
    }
    setFile({ uri: asset.uri, name: asset.name, size: asset.size ?? null, mimeType });
  };

  const onSubmit = async (values: UploadDocumentInput) => {
    setFailure(null);
    if (!file) {
      setFileError('Choose a file first.');
      return;
    }
    const input: LockerUpload = { title: values.title, category: values.category, documentDate: values.document_date, file };
    try {
      await upload.mutateAsync(input);
      setSaved(true);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The report could not be uploaded.');
    }
  };

  if (saved) {
    return (
      <>
        <Card>
          <Text style={styles.done}>Report saved to your Health Locker.</Text>
        </Card>
        <Button label="Done" onPress={onDone} />
      </>
    );
  }

  return (
    <>
      {failure ? <ErrorBox message={failure} /> : null}
      <Card>
        <Text style={styles.label}>File</Text>
        {file ? <Text style={[styles.meta, monoStyle]}>{file.name}</Text> : <Text style={styles.meta}>No file chosen</Text>}
        {fileError ? <Text style={styles.error}>{fileError}</Text> : null}
        <Button label={file ? 'Choose another file' : 'Choose a file'} variant="secondary" onPress={() => void pickFile()} />
      </Card>

      <Controller
        control={form.control}
        name="title"
        render={({ field }) => (
          <TextField label="Title" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.title?.message} placeholder="For example: Thyroid panel" />
        )}
      />

      <View style={styles.block}>
        <Text style={styles.label}>Category</Text>
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <View style={styles.chips}>
              {DOCUMENT_CATEGORIES.map((category) => {
                const active = field.value === category;
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => field.onChange(category)}
                    style={[styles.chip, active ? styles.chipOn : null]}
                  >
                    <Text style={[styles.chipText, active ? styles.chipTextOn : null]}>{CATEGORY_LABEL[category]}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
        {errors.category ? <Text style={styles.error}>{errors.category.message}</Text> : null}
      </View>

      <Controller
        control={form.control}
        name="document_date"
        render={({ field }) => (
          <TextField
            label="Date on the document (YYYY-MM-DD)"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            error={errors.document_date?.message}
          />
        )}
      />

      <Button label="Save to Health Locker" busy={isSubmitting || upload.isPending} onPress={() => void form.handleSubmit(onSubmit)()} />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACE.sm },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  meta: { color: COLORS.textMuted, fontSize: 13 },
  error: { color: COLORS.accentRed, fontSize: 12 },
  done: { color: COLORS.accentEmerald, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.s2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line2,
  },
  chipOn: { backgroundColor: COLORS.accentBlue, borderColor: COLORS.accentBlue },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: COLORS.textPrimary },
});
