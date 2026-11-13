import { useState } from "react";
import { Drawer, DrawerHeader, ERROR_BOX } from "@healthoraa/ui";
import type { QueueConsultation } from "../../types/queue";
import { getStoredPrescription } from "../../lib/prescriptionStore";
import { toFormValues } from "../../lib/prescriptionOptions";
import { useIntakePreview } from "../../hooks/useIntakePreview";
import { useLatestPrescription } from "../../hooks/useLatestPrescription";
import { isMockConsultation } from "../../lib/chatFallback";
import { PatientBanner } from "./PatientBanner";
import { PrescriptionForm } from "./PrescriptionForm";

interface PrescriptionDrawerProps {
  consultation: QueueConsultation | null;
  // Changes on every open, so the encounter body remounts with fresh form state.
  sessionKey: number;
  onClose: () => void;
  onSigned: () => void;
}

export default function PrescriptionDrawer({ consultation, sessionKey, onClose, onSigned }: PrescriptionDrawerProps) {
  // Keep the last consultation mounted while the drawer slides out, so the content does not vanish early.
  const [shown, setShown] = useState<QueueConsultation | null>(consultation);
  if (consultation && consultation !== shown) setShown(consultation);

  return (
    <Drawer isOpen={consultation !== null} onClose={onClose} labelledBy="rx-drawer-title" className="max-w-2xl p-6 md:p-8">
      {shown && (
        <EncounterBody
          key={`${shown.id}-${sessionKey}`}
          consultation={shown}
          onClose={onClose}
          onSigned={onSigned}
        />
      )}
    </Drawer>
  );
}

function EncounterBody({
  consultation,
  onClose,
  onSigned,
}: {
  consultation: QueueConsultation;
  onClose: () => void;
  onSigned: () => void;
}) {
  const intake = useIntakePreview(consultation.id);
  const live = !isMockConsultation(consultation.id);
  const saved = useLatestPrescription(consultation.id);

  // Live consultations start from the saved prescription; demo ones from this device's copy.
  // The form mounts once, so it waits for the saved version rather than starting blank.
  const header = (
    <DrawerHeader
      eyebrow="Telemedicine encounter"
      title="Prescription Composer"
      titleId="rx-drawer-title"
      onClose={onClose}
    />
  );
  if (live && saved.isPending) {
    return (
      <>
        {header}
        <p className="py-10 text-center text-sm text-text-secondary">Loading the saved prescription...</p>
      </>
    );
  }
  if (live && saved.isError) {
    return (
      <>
        {header}
        <div className={ERROR_BOX}>
          Could not load the saved prescription. Close and try again, so an empty form does not replace it.
        </div>
      </>
    );
  }
  const initialValues = live
    ? (saved.data ?? toFormValues(undefined))
    : toFormValues(getStoredPrescription(consultation.id));

  return (
    <>
      {header}
      <PatientBanner consultation={consultation} intake={intake.data} />
      <PrescriptionForm
        consultation={consultation}
        initialValues={initialValues}
        onCancel={onClose}
        onSigned={onSigned}
      />
    </>
  );
}
