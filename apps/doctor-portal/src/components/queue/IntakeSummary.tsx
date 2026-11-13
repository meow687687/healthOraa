import type { QueueConsultation } from "../../types/queue";

const NOT_RECORDED = "Not recorded";

const listOrEmpty = (items: string[] | undefined): string =>
  items && items.length > 0 ? items.join(", ") : "None reported";

// What the doctor reads before the call. Missing values say so, rather than showing a dash.
// `stacked` gives two columns for narrow panes, such as the room's intake column.
export function IntakeSummary({ consultation, stacked = false }: { consultation: QueueConsultation; stacked?: boolean }) {
  const sex = consultation.gender ? consultation.gender.charAt(0).toUpperCase() + consultation.gender.slice(1) : null;
  const ageSex =
    consultation.age !== null ? `${consultation.age} years${sex ? `, ${sex}` : ""}` : NOT_RECORDED;

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-primary">{consultation.chiefComplaint ?? "No chief complaint recorded"}</p>
      <dl className={stacked ? "grid grid-cols-2 gap-x-4 gap-y-4" : "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"}>
        <Field label="Age and sex">{ageSex}</Field>
        <Field label="Symptoms since">{consultation.symptomsDuration ?? NOT_RECORDED}</Field>
        <Field label="Allergies">{listOrEmpty(consultation.allergies)}</Field>
        <Field label="Current medicines">{listOrEmpty(consultation.medications)}</Field>
      </dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-text-primary">{children}</dd>
    </div>
  );
}
