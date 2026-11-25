import { LABEL } from "@healthoraa/ui";
import { formatDocumentDate, formatFileSize } from "../../lib/fileFormat";
import type { LockerDocument } from "../../types/locker";

export function DocumentPreviewHeader({
  document,
}: {
  document: LockerDocument;
}) {
  return (
    <header className="space-y-2 border-b border-aura-line pb-5">
      <p className={LABEL}>
        Preview · {formatDocumentDate(document.documentDate)} ·{" "}
        {formatFileSize(document.fileSizeBytes)}
      </p>
      <h2
        id="preview-title"
        className="text-lg font-bold tracking-tight text-white"
      >
        {document.title}
      </h2>
      {document.source === "upload" && (
        <p
          role="note"
          className="rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-4 py-3 text-xs leading-relaxed text-text-primary"
        >
          Session only. This file has not been saved to your medical vault and
          will be removed when you reload the page.
        </p>
      )}
      {document.source === "demo" && (
        <p
          role="note"
          className="rounded-xl border border-accent-blue/30 bg-accent-blue/10 px-4 py-3 text-xs leading-relaxed text-text-primary"
        >
          Synthetic demo sample. It is not a real medical record, contains no
          patient information, and is not medical advice.
        </p>
      )}
    </header>
  );
}
