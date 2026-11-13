import { useState, type ReactNode } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "../../lib/cn";

// A chart with a "View as table" switch. The table carries the same numbers for screen readers and for
// anyone who needs exact values.
export function ChartCard({
  title,
  description,
  chart,
  table,
  className,
}: {
  title: string;
  description?: string;
  chart: ReactNode;
  table?: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={cn("flex flex-col rounded-3xl border border-aura-line bg-aura-s1 p-5 shadow-aura-card md:p-6", className)}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description ? <p className="mt-1 text-[13px] text-text-muted">{description}</p> : null}
        </div>
        {table ? (
          <button
            type="button"
            aria-pressed={showTable}
            onClick={() => setShowTable((value) => !value)}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-aura-line2 px-3 text-[13px] font-semibold text-text-secondary transition-colors duration-150 hover:text-text-primary cursor-pointer"
          >
            {showTable ? <BarChart3 className="h-4 w-4" aria-hidden="true" /> : <Table2 className="h-4 w-4" aria-hidden="true" />}
            {showTable ? "View as chart" : "View as table"}
          </button>
        ) : null}
      </header>
      <div className="mt-5 flex-1">{showTable && table ? table : chart}</div>
    </section>
  );
}

// Plain table used for the "View as table" option.
export function ValueTable({
  caption,
  columns = [],
  rows,
}: {
  caption: string;
  columns?: string[];
  rows: { label: string; values: string[] }[];
}) {
  return (
    <div className="max-h-72 overflow-auto rounded-2xl border border-aura-line">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {columns.length > 0 && (
          <thead>
            <tr className="border-b border-aura-line">
              <td />
              {columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-2.5 text-right text-[13px] font-medium text-text-muted">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-aura-line last:border-0">
              <th scope="row" className="px-4 py-2.5 font-medium text-text-secondary">
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <td key={index} className="px-4 py-2.5 text-right font-mono tabular-nums text-text-primary">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
