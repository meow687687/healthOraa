import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { BTN_PRIMARY, LABEL, Modal } from "@healthoraa/ui";
import { useObjectUrl } from "../../hooks/useObjectUrl";
import { downloadLocalDocument, downloadRecord } from "../../lib/download";
import { createRecordLink } from "../../lib/recordFiles";
import { formatDocumentDate, formatFileSize } from "../../lib/fileFormat";
import type { LockerDocument } from "../../types/locker";

// Uploads preview their own file. Records open through a fresh signed link. Demo documents show their summary.
export function DocumentPreviewModal({
  document,
  onClose,
  onDownloadError,
}: {
  document: LockerDocument | null;
  onClose: () => void;
  onDownloadError: (message: string) => void;
}) {
  return (
    <Modal isOpen={document !== null} onClose={onClose} labelledBy="preview-title" className="max-w-2xl">
      {document && <PreviewBody document={document} onClose={onClose} onDownloadError={onDownloadError} />}
    </Modal>
  );
}

function PreviewBody({
  document,
  onClose,
  onDownloadError,
}: {
  document: LockerDocument;
  onClose: () => void;
  onDownloadError: (message: string) => void;
}) {
  const localUrl = useObjectUrl(document.file);
  const isRecord = document.filePath !== null;
  // Signed links expire after 60 seconds, so each preview requests a new one and nothing is cached.
  const link = useQuery({
    queryKey: ["locker", "link", document.id],
    queryFn: () => createRecordLink(document.filePath ?? ""),
    enabled: isRecord,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const url = document.file ? localUrl : (link.data ?? null);

  const download = async () => {
    try {
      if (isRecord) await downloadRecord(document);
      else downloadLocalDocument(document);
    } catch (err) {
      onDownloadError(err instanceof Error ? err.message : "The file could not be downloaded.");
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <header className="space-y-2 border-b border-aura-line pb-5">
        <p className={LABEL}>
          Preview · {formatDocumentDate(document.documentDate)} · {formatFileSize(document.fileSizeBytes)}
        </p>
        <h2 id="preview-title" className="text-lg font-bold tracking-tight text-white">
          {document.title}
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {url && document.fileType === "image" && (
          <img src={url} alt={document.title} className="mx-auto max-h-[60vh] rounded-xl border border-aura-line object-contain" />
        )}
        {url && document.fileType === "pdf" && (
          <iframe title={document.title} src={url} className="h-[60vh] w-full rounded-xl border border-aura-line bg-white" />
        )}
        {isRecord && link.isPending && <p className="py-10 text-center text-sm text-text-secondary">Opening a secure link...</p>}
        {isRecord && link.isError && (
          <p className="rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-xs text-accent-red">
            This file could not be opened. Records need a signed-in session. {link.error.message}
          </p>
        )}
        {!isRecord && !url && document.summary && (
          <div className="space-y-3 rounded-2xl border border-aura-line bg-aura-s2 p-5">
            <p className="text-sm leading-relaxed text-text-primary">{document.summary}</p>
            <p className="text-xs text-text-muted">Demo summary. The original file is not stored yet.</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-aura-line pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={download}
          disabled={isRecord && !link.data}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-aura-line2 bg-aura-s3 px-5 py-2.5 text-xs font-semibold text-text-primary hover:bg-aura-s2 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
        <button type="button" onClick={onClose} className={BTN_PRIMARY}>
          Close preview
        </button>
      </div>
    </div>
  );
}
