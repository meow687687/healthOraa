import { Modal, BTN_PRIMARY, LABEL } from "@healthoraa/ui";
import { formatIstDateTime } from "../../lib/istTime";
import type { PrescriptionRecord } from "../../types/consultations";

// Preview of a signed prescription. The download action here is a preview, not a PDF export.
export function RxPreviewModal({ prescription, onClose }: { prescription: PrescriptionRecord; onClose: () => void }) {
  return (
    <Modal isOpen onClose={onClose} labelledBy="rx-title">
      <div className="space-y-5 overflow-y-auto pr-1">
        <header className="space-y-2 border-b border-aura-line pb-5">
          <p className={LABEL}>Digital prescription</p>
          <h2 id="rx-title" className="text-lg font-bold tracking-tight text-white">
            {prescription.diagnosis}
          </h2>
          <p className="font-mono text-xs text-text-secondary">
            Issued by {prescription.doctorName} · {formatIstDateTime(prescription.issuedAt)} IST
          </p>
        </header>

        <section aria-label="Medicines" className="space-y-3">
          {prescription.medicines.map((medicine) => (
            <div key={medicine.name} className="rounded-2xl border border-aura-line bg-aura-s2 p-4">
              <p className="text-sm font-semibold text-text-primary">{medicine.name}</p>
              <p className="text-xs text-text-secondary">
                {medicine.dosage} · {medicine.frequency}
              </p>
              <p className="font-mono text-[11px] text-text-muted">
                {medicine.durationDays} days{medicine.instructions ? ` · ${medicine.instructions}` : ""}
              </p>
            </div>
          ))}
        </section>

        <p className="text-xs text-text-secondary">Follow-up in {prescription.followupDays} days.</p>

        <div className="flex justify-end border-t border-aura-line pt-5">
          <button type="button" onClick={onClose} className={BTN_PRIMARY}>
            Close preview
          </button>
        </div>
      </div>
    </Modal>
  );
}
