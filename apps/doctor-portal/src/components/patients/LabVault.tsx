import { useState } from "react";
import { Download, Eye, EyeOff, FileText, Image as ImageIcon } from "lucide-react";
import { Badge } from "@healthoraa/ui";
import type { LabReport } from "../../types/patients";
import { formatDate } from "../../lib/prescriptionOptions";

const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-aura-line2 bg-aura-s3 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary";

// Writes the report summary as a text file. Original PDFs and images are not stored yet.
const downloadSummary = (report: LabReport): void => {
  const body = `${report.title}\nCollected: ${formatDate(new Date(report.collectedOn))}\nFile: ${report.fileName}\n\n${report.summary}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.fileName}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

function LabCard({ report }: { report: LabReport }) {
  const [quickView, setQuickView] = useState(false);
  const Icon = report.kind === "pdf" ? FileText : ImageIcon;

  return (
    <article className="space-y-3 rounded-2xl border border-aura-line bg-aura-s2 p-4">
      <header className="flex items-start gap-3">
        <div className="rounded-full border border-accent-blue/20 bg-accent-blue/10 p-2 text-accent-blue">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <h4 className="text-sm font-semibold text-text-primary">{report.title}</h4>
          <p className="font-mono text-[11px] text-text-muted">
            {formatDate(new Date(report.collectedOn))} · {report.fileName} · {report.sizeKb} KB
          </p>
        </div>
        <Badge tone="neutral">{report.kind.toUpperCase()}</Badge>
      </header>

      <p className={quickView ? "text-xs leading-relaxed text-text-secondary" : "line-clamp-2 text-xs text-text-secondary"}>
        {report.summary}
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={quickView} onClick={() => setQuickView((open) => !open)} className={PILL}>
          {quickView ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {quickView ? "Close quick view" : "Quick view"}
        </button>
        <button type="button" onClick={() => downloadSummary(report)} className={PILL}>
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </div>
    </article>
  );
}

export function LabVault({ reports }: { reports: LabReport[] }) {
  if (reports.length === 0) {
    return (
      <p className="rounded-2xl border border-aura-line bg-aura-s2 px-4 py-6 text-center text-xs text-text-muted">
        No lab reports uploaded yet.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {reports.map((report) => (
        <LabCard key={report.id} report={report} />
      ))}
    </div>
  );
}
