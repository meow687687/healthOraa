import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge, ERROR_BOX, EmptyState, INPUT, PANEL, SkeletonBlock, TABLE_HEAD, cn } from "@healthoraa/ui";
import { useDoctorPatients } from "../../hooks/useDoctorPatients";
import { useAuth } from "../../context/AuthContext";
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
  const { isDemoData } = useAuth();
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
        {source && <Badge tone={isDemoData || source !== "live" ? "amber" : "emerald"}>{isDemoData ? "Demo records · synthetic" : source === "live" ? "Live records" : "Sample records"}</Badge>}
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
          <div className="space-y-3 p-2" aria-busy="true" aria-label="Loading patients">
            {[0, 1, 2, 3].map((row) => (
              <SkeletonBlock key={row} className="h-14" />
            ))}
          </div>
        ) : filtered.length === 0 && search.trim() === "" ? (
          <EmptyState
            icon={Users}
            title="No patients yet"
            description="Patients appear here once they have had a consultation with you."
            action={{ label: "Refresh patients", onClick: () => void query.refetch() }}
            className="border-0 bg-transparent shadow-none"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No patients match “${search.trim()}”`}
            description="Try another name, condition or diagnosis."
            action={{ label: "Clear search", onClick: () => setSearch("") }}
            className="border-0 bg-transparent shadow-none"
          />
        ) : (
          <div className="space-y-3 px-4 py-4 md:hidden">
            {filtered.map((patient) => {
              const last = patient.visits[patient.visits.length - 1];
              const extra = patient.conditions.length - 2;
              return (
                <article key={patient.id} className="rounded-2xl border border-aura-line bg-aura-s2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary">{patient.name}</h3>
                      <p className="mt-1 text-xs text-text-muted">{patient.phone ?? "No phone on file"}</p>
                    </div>
                    <Badge tone="neutral">{patient.visits.length} visit{patient.visits.length === 1 ? "" : "s"}</Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-aura-s1/70 p-3">
                    <div><dt className="text-[11px] text-text-muted">Age / sex</dt><dd className="mt-1 text-sm text-text-primary">{patient.age !== null && patient.sex ? `${patient.age} / ${patient.sex}` : "Not recorded"}</dd></div>
                    <div><dt className="text-[11px] text-text-muted">Last visit</dt><dd className="mt-1 text-sm text-text-primary">{last ? formatDate(new Date(last.date)) : "—"}</dd></div>
                  </dl>
                  <div className="mt-3">
                    <p className="text-[11px] text-text-muted">Chronic conditions</p>
                    {patient.conditions.length === 0 ? <p className="mt-1 text-xs text-text-secondary">None recorded</p> : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {patient.conditions.slice(0, 2).map((condition) => <Badge key={condition} tone="blue">{condition}</Badge>)}
                        {extra > 0 && <Badge tone="neutral">+{extra} more</Badge>}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedId(patient.id)} className={cn(OPEN_PILL, "mt-4 min-h-10 w-full justify-center")}>
                    Open patient dossier
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {!query.isPending && filtered.length > 0 && (
          <div className="table-scroll -mx-6 hidden overflow-x-auto md:block">
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

      <PatientDossierDrawer patient={selected} isDemoData={isDemoData} onClose={() => setSelectedId(null)} />
    </div>
  );
}
