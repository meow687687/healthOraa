import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge, ERROR_BOX, INPUT, PANEL, TABLE_HEAD, cn } from "@healthoraa/ui";
import { useDoctorPatients } from "../../hooks/useDoctorPatients";
import { formatDate } from "../../lib/prescriptionOptions";
import type { PatientRecord } from "../../types/patients";
import { PatientDossierDrawer } from "./PatientDossierDrawer";

const OPEN_PILL =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-aura-line2 bg-aura-s3 px-3 py-1.5 text-xs font-semibold text-accent-blue transition-colors hover:bg-aura-s2";

const matchesQuery = (patient: PatientRecord, query: string): boolean => {
  const haystack = [
    patient.name,
    ...patient.conditions,
    ...patient.visits.map((visit) => visit.diagnosis ?? ""),
  ];
  return haystack.some((text) => text.toLowerCase().includes(query));
};

export default function PatientsView() {
  const query = useDoctorPatients();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const patients = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? patients.filter((patient) => matchesQuery(patient, needle)) : patients;
  }, [patients, search]);

  const selected = patients.find((patient) => patient.id === selectedId) ?? null;
  const source = patients[0]?.dataSource;

  return (
    <div className="space-y-6">
      <section className={cn(PANEL, "flex flex-wrap items-center justify-between gap-4")}>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Patients</h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {query.isPending ? "Loading patients..." : `${patients.length} patient${patients.length === 1 ? "" : "s"} seen by you`}
          </p>
        </div>
        {source && <Badge tone={source === "live" ? "emerald" : "amber"}>{source === "live" ? "Live records" : "Mock records"}</Badge>}
      </section>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          aria-label="Search patients"
          placeholder="Search by name, condition or diagnosis"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={cn(INPUT, "rounded-full pl-10")}
        />
      </div>

      {query.isError && <div className={ERROR_BOX}>Could not load patients.</div>}

      <div className={cn(PANEL, "overflow-hidden")}>
        {query.isPending ? (
          <p className="py-16 text-center text-sm text-text-secondary">Loading patients...</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-text-muted">No patients match “{search.trim()}”.</p>
        ) : (
          <div className="table-scroll -mx-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD}>
                  <th className="px-6 py-4 font-medium">Patient</th>
                  <th className="px-6 py-4 font-medium">Age / Sex</th>
                  <th className="px-6 py-4 font-medium">Chronic Conditions</th>
                  <th className="px-6 py-4 font-medium">Last Visit</th>
                  <th className="px-6 py-4 font-medium">Consultations</th>
                  <th className="px-6 py-4 font-medium" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => {
                  const last = patient.visits[patient.visits.length - 1];
                  const extra = patient.conditions.length - 2;
                  return (
                    <tr
                      key={patient.id}
                      onClick={() => setSelectedId(patient.id)}
                      className={cn(
                        "group cursor-pointer border-b border-aura-line transition-colors last:border-0",
                        selectedId === patient.id ? "bg-aura-s2" : "hover:bg-aura-s2/60",
                      )}
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary">{patient.name}</p>
                        <p className="font-mono text-xs text-text-muted">{patient.phone ?? "No phone on file"}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-text-secondary">
                        {patient.age !== null && patient.sex ? `${patient.age} / ${patient.sex[0]}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        {patient.conditions.length === 0 ? (
                          <span className="text-xs text-text-muted">None recorded</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {patient.conditions.slice(0, 2).map((condition) => (
                              <Badge key={condition} tone="blue">{condition}</Badge>
                            ))}
                            {extra > 0 && <Badge tone="neutral">+{extra} more</Badge>}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-text-secondary">
                        {last ? formatDate(new Date(last.date)) : "—"}
                      </td>
                      <td className="px-6 py-4 font-mono tabular-nums font-semibold text-text-primary">
                        {patient.visits.length}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(patient.id);
                          }}
                          className={OPEN_PILL}
                        >
                          Open dossier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PatientDossierDrawer patient={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
