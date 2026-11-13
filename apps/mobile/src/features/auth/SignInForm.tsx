import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@healthoraa/validation';
import { useAuth } from '../../auth/AuthProvider';
import { Button, ErrorBox } from '../../components/primitives';
import { TextField } from '../../components/TextField';
import { View } from 'react-native';
import { SPACE } from '../../../constants/theme';

export function SignInForm() {
  const { signIn } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    setFailure(null);
    try {
      await signIn(values.email, values.password);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Sign in failed. Try again.');
    }
  };

  const { errors, isSubmitting } = form.formState;

  return (
    <>
      {failure ? <ErrorBox message={failure} /> : null}
      <Controller
        control={form.control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      <Button label="Sign in" busy={isSubmitting} onPress={() => void form.handleSubmit(onSubmit)()} />
      <DevDemoSignIn onFailure={setFailure} />
      <View style={{ height: SPACE.sm }} />
    </>
  );
}

// Development builds only. __DEV__ is false in release bundles, so this branch and its credentials are removed.
function DevDemoSignIn({ onFailure }: { onFailure: (message: string) => void }) {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!__DEV__) return null;
  return (
    <Button
      label="Sign in as Demo Patient"
      variant="secondary"
      busy={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await signIn('patient@healthoraa.com', 'HealthOraa@2026');
        } catch (error) {
          onFailure(error instanceof Error ? error.message : 'Demo sign in failed.');
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
