import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { COLORS, RADIUS, SPACE } from '../../constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...input }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={COLORS.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line2,
    backgroundColor: COLORS.s2,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACE.lg,
    fontSize: 16,
  },
  inputError: { borderColor: COLORS.accentRed },
  error: { color: COLORS.accentRed, fontSize: 12 },
});
