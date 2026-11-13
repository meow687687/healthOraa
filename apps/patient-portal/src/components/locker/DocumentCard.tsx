import { Download, Eye, FileText, Image as ImageIcon } from "lucide-react";
import { Badge, LABEL, PANEL, cn } from "@healthoraa/ui";
import { formatDocumentDate, formatFileSize } from "../../lib/fileFormat";
import type { LockerDocument } from "../../types/locker";
import { DOCUMENT_CATEGORY_LABEL } from "./categoryLabels";

const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-aura-line2 bg-aura-s3 px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-aura-s2 disabled:cursor-not-allowed disabled:opacity-50";

export function DocumentCard({
  document,
  onPreview,
  onDownload,
}: {
  document: LockerDocument;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const Icon = document.fileType === "pdf" ? FileText : ImageIcon;
  const lockedTitle = document.canOpen ? undefined : "Sign in to open records from your medical vault";

  return (
    <article className={cn(PANEL, "flex flex-col gap-4 p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-full border border-accent-blue/20 bg-accent-blue/10 p-2.5 text-accent-blue">
          <Icon className="h-4 w-4" />
        </div>
        <Badge tone="neutral">{DOCUMENT_CATEGORY_LABEL[document.category]}</Badge>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">{document.title}</h3>
        <p className={LABEL}>{formatDocumentDate(document.documentDate)}</p>
        {/* Records without a stored size show no size chip, rather than "Size unknown". */}
        {document.fileSizeBytes !== null && (
          <span className="inline-flex rounded-full border border-aura-line2 bg-aura-s2 px-2 py-0.5 font-mono text-[11px] text-text-secondary">
            {formatFileSize(document.fileSizeBytes)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onPreview} disabled={!document.canOpen} title={lockedTitle} className={PILL}>
          <Eye className="h-3.5 w-3.5" />
          Preview Document
        </button>
        <button type="button" onClick={onDownload} disabled={!document.canOpen} title={lockedTitle} className={PILL}>
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </div>
    </article>
  );
}
