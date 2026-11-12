import { useState } from "react";
import { Drawer, DrawerHeader } from "@healthoraa/ui";
import type { QueueConsultation } from "../../types/queue";
import { getStoredPrescription } from "../../lib/prescriptionStore";
import { toFormValues } from "../../lib/prescriptionOptions";
import { useIntakePreview } from "../../hooks/useIntakePreview";
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
  // Read once per open: a re-signed prescription updates the stored copy, not this form.
  const [initialValues] = useState(() => toFormValues(getStoredPrescription(consultation.id)));

  return (
    <>
      <DrawerHeader
        eyebrow="Telemedicine encounter"
        title="Prescription Composer"
        titleId="rx-drawer-title"
        onClose={onClose}
      />
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
