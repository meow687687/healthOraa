import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updatePractitionerProfileSchema } from "@healthoraa/validation";
import type { UpdatePractitionerProfileInput } from "@healthoraa/validation";
import { PANEL } from "@healthoraa/ui";
import { usePractitionerProfile, useUpdatePractitionerProfile } from "../../hooks/usePractitionerProfile";
import type { PractitionerProfile } from "../../types/profile";
import { ProfileHeaderCard } from "./ProfileHeaderCard";
import { PracticeConfigFields } from "./PracticeConfigFields";
import { DigitalSignatureCard } from "./DigitalSignatureCard";
import { SaveSettingsBar } from "./SaveSettingsBar";

export default function PractitionerProfileView() {
  const query = usePractitionerProfile();

  if (query.isPending) {
    return <p className="py-16 text-center text-sm text-text-secondary">Loading profile...</p>;
  }
  if (!query.data) {
    return <p className="py-16 text-center text-sm text-text-muted">Could not load your profile.</p>;
  }
  return <ProfileEditor profile={query.data} />;
}

function ProfileEditor({ profile }: { profile: PractitionerProfile }) {
  const save = useUpdatePractitionerProfile();
  const form = useForm<UpdatePractitionerProfileInput>({
    resolver: zodResolver(updatePractitionerProfileSchema),
    mode: "onTouched",
    defaultValues: {
      qualification: profile.qualification,
      consultation_fee_inr: profile.consultationFeeInr,
      slot_duration_minutes: profile.slotDurationMinutes,
      bio: profile.bio,
      languages_spoken: profile.languagesSpoken,
      // NaN leaves the years field empty, so the schema asks for a value.
      years_of_experience: profile.yearsOfExperience ?? Number.NaN,
    },
  });

  const onSubmit = async (values: UpdatePractitionerProfileInput) => {
    try {
      await save.mutateAsync(values);
      form.reset(values);
    } catch {
      // The message is shown in the save bar; the form stays dirty so the doctor can retry.
    }
  };

  return (
    <div className="space-y-6">
      <ProfileHeaderCard profile={profile} />

      <form id="practice-settings" noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <section aria-labelledby="practice-config-title" className={PANEL}>
          <h3 id="practice-config-title" className="mb-6 text-sm font-semibold text-text-primary">
            Practice configuration
          </h3>
          <PracticeConfigFields form={form} />
        </section>

        <DigitalSignatureCard />

        <SaveSettingsBar
          isDirty={form.formState.isDirty}
          isSaving={save.isPending || form.formState.isSubmitting}
          errorMessage={save.isError ? save.error.message : null}
        />
      </form>
    </div>
  );
}
