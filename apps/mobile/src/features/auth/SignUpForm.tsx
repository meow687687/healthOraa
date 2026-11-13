import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@healthoraa/validation';
import { useAuth } from '../../auth/AuthProvider';
import { Button, ErrorBox, Pill } from '../../components/primitives';
import { TextField } from '../../components/TextField';

// The form validates the shared signup schema. Customer sign-up always uses the patient role, so the role
// field is fixed here and is not shown. The server trigger applies the same rule.
const CUSTOMER_ROLE = 'patient' as const;

export function SignUpForm() {
  const { signUp } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: { full_name: '', email: '', password: '', role: CUSTOMER_ROLE },
  });

  const onSubmit = async (values: SignupInput) => {
    setFailure(null);
    try {
      const result = await signUp(values.full_name, values.email, values.password);
      setConfirmation(result.needsConfirmation);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Sign up failed. Try again.');
    }
  };

  const { errors, isSubmitting } = form.formState;

  if (confirmation) {
    return (
      <>
        <Pill label="Check your email" tone="blue" />
        <ErrorBox message="We sent a confirmation link. Open it, then come back and sign in." />
      </>
    );
  }

  return (
    <>
      {failure ? <ErrorBox message={failure} /> : null}
      <Controller
        control={form.control}
        name="full_name"
        render={({ field }) => (
          <TextField
            label="Full name"
            autoComplete="name"
            textContentType="name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.full_name?.message}
          />
        )}
      />
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
            label="Password (8 characters or more)"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      <Button label="Create account" busy={isSubmitting} onPress={() => void form.handleSubmit(onSubmit)()} />
    </>
  );
}
