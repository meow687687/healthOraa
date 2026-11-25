import { FileText } from "lucide-react";
import { formatFileSize } from "../../lib/fileFormat";
import type { LockerDocument } from "../../types/locker";

export function DemoPdfPreview({ document }: { document: LockerDocument }) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-lg sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
            Synthetic document preview
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            {document.title}
          </h3>
        </div>
        <FileText
          className="mt-1 h-6 w-6 shrink-0 text-blue-700"
          aria-hidden="true"
        />
      </div>
      <p className="mt-5 text-sm leading-relaxed text-slate-700">
        {document.summary}
      </p>
      <p className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
        PDF · {formatFileSize(document.fileSizeBytes)} · The attached file is
        available to download.
      </p>
    </div>
  );
}
