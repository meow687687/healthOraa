import { useMemo, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { BTN_PRIMARY, EmptyState, ERROR_BOX, LABEL } from "@healthoraa/ui";
import { useHealthLocker } from "../../hooks/useHealthLocker";
import { downloadLocalDocument, downloadRecord } from "../../lib/download";
import type { LockerDocument } from "../../types/locker";
import { BiomarkerStrip } from "./BiomarkerStrip";
import { CategoryFilter, FILTER_OPTIONS } from "./CategoryFilter";
import type { LockerFilter } from "./CategoryFilter";
import { DocumentCard } from "./DocumentCard";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { UploadDocumentDrawer } from "./UploadDocumentDrawer";

// Each filter maps to the document categories it shows. "All" shows everything.
const matchesFilter = (document: LockerDocument, filter: LockerFilter): boolean => {
  switch (filter) {
    case "all":
      return true;
    case "blood":
      return document.category === "blood_panel";
    case "imaging":
      return document.category === "imaging_radiology";
    case "prescriptions":
      return document.category === "prescription";
  }
};

export default function HealthLockerView() {
  const locker = useHealthLocker();
  const [filter, setFilter] = useState<LockerFilter>("all");
  const [previewing, setPreviewing] = useState<LockerDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = async (doc: LockerDocument) => {
    setDownloadError(null);
    try {
      if (doc.filePath) await downloadRecord(doc);
      else downloadLocalDocument(doc);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "The file could not be downloaded.");
    }
  };

  const documents = useMemo(() => locker.data?.documents ?? [], [locker.data]);
  const counts = useMemo(
    () =>
      Object.fromEntries(FILTER_OPTIONS.map((option) => [option.id, documents.filter((doc) => matchesFilter(doc, option.id)).length])) as Record<LockerFilter, number>,
    [documents],
  );
  const visible = documents.filter((doc) => matchesFilter(doc, filter));

  if (locker.isPending) {
    return <p className="py-16 text-center text-sm text-text-secondary">Opening your locker...</p>;
  }
  if (!locker.data) {
    return <div className={ERROR_BOX}>Could not open your locker.</div>;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className={LABEL}>Health Locker</p>
          <h2 className="text-xl font-bold tracking-tight text-white">Diagnostic records and trends</h2>
        </div>
        <button type="button" onClick={() => setUploading(true)} className={BTN_PRIMARY}>
          <Upload className="h-4 w-4" />
          Upload document
        </button>
      </header>

      <section aria-labelledby="biomarkers-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="biomarkers-title" className="text-sm font-semibold text-text-primary">
            Key biomarkers
          </h3>
          <p className="text-[11px] text-text-muted">
            {locker.data.biomarkerSource === "live" ? "From your lab results" : "Demo values. Sign in to load your lab results."}
          </p>
        </div>
        <BiomarkerStrip biomarkers={locker.data.biomarkers} />
      </section>

      <section aria-labelledby="documents-title" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 id="documents-title" className="text-sm font-semibold text-text-primary">
            Documents
          </h3>
          <CategoryFilter value={filter} counts={counts} onChange={setFilter} />
        </div>

        {downloadError && <div className={ERROR_BOX}>{downloadError}</div>}

        {visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents in this category yet"
            description="Upload a report or prescription to keep it with your health records."
            action={{ label: "Upload document", onClick: () => setUploading(true) }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onPreview={() => setPreviewing(document)}
                onDownload={() => download(document)}
              />
            ))}
          </div>
        )}
      </section>

      <DocumentPreviewModal
        document={previewing}
        onClose={() => setPreviewing(null)}
        onDownloadError={setDownloadError}
      />
      {uploading && <UploadDocumentDrawer onClose={() => setUploading(false)} />}
    </div>
  );
}
