import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "./cn";
import { INPUT } from "./tokens";
import { SkeletonBlock } from "./Skeleton";

export interface DataColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  // Give a value to make the column sortable.
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  // Columns with a lower priority are hidden below the xl breakpoint.
  priority?: "primary" | "secondary";
}

export interface DataFilter<T> {
  active: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  // Returns true when a row belongs to the filter with this id. "all" always matches.
  match: (row: T, id: string) => boolean;
}

interface DataTableProps<T> {
  caption: string;
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  // Text used by the search box. Leave out to hide the search box.
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filter?: DataFilter<T>;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyState: ReactNode;
  pageSize?: number;
  toolbarEnd?: ReactNode;
}

type SortState = { id: string; direction: "asc" | "desc" } | null;

const TABLE_CELL = "px-5 py-4 align-middle";

export function DataTable<T>({
  caption,
  rows,
  columns,
  getRowId,
  searchText,
  searchPlaceholder = "Search",
  filter,
  onRowClick,
  isLoading = false,
  emptyState,
  pageSize = 25,
  toolbarEnd,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter && !filter.match(row, filter.active)) return false;
      if (needle && searchText && !searchText(row).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, query, filter, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((candidate) => candidate.id === sort.id);
    if (!column?.sortValue) return filtered;
    const value = column.sortValue;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return 0;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (column: DataColumn<T>) => {
    if (!column.sortValue) return;
    setSort((previous) => {
      if (!previous || previous.id !== column.id) return { id: column.id, direction: "asc" };
      if (previous.direction === "asc") return { id: column.id, direction: "desc" };
      return null;
    });
  };

  // Only the row itself opens on Enter or Space. A key press on a button or switch inside the row
  // belongs to that control.
  const activate = (row: T, event: KeyboardEvent<HTMLElement>) => {
    if (!onRowClick || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  const showEmpty = !isLoading && sorted.length === 0;

  return (
    <section className="rounded-3xl border border-aura-line bg-aura-s1 shadow-aura-card overflow-hidden">
      {(searchText || filter || toolbarEnd) && (
        <div className="flex flex-col gap-3 border-b border-aura-line p-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {filter?.options.map((option) => {
              const count = rows.filter((row) => filter.match(row, option.id)).length;
              const selected = filter.active === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => filter.onChange(option.id)}
                  className={cn(
                    "inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors duration-150 cursor-pointer",
                    selected
                      ? "border-aura-line2 bg-aura-s3 text-text-primary"
                      : "border-transparent text-text-muted hover:text-text-primary",
                  )}
                >
                  {option.label}
                  <span className="font-mono tabular-nums text-[12px] text-text-muted">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {searchText && (
              <label className="relative block w-full md:w-72">
                <span className="sr-only">{searchPlaceholder}</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                  placeholder={searchPlaceholder}
                  className={cn(INPUT, "rounded-full py-2.5 pl-10 text-[13px]")}
                />
              </label>
            )}
            {toolbarEnd}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 p-5" aria-busy="true" aria-label={`Loading ${caption}`}>
          {[0, 1, 2, 3, 4].map((row) => (
            <SkeletonBlock key={row} className="h-14" />
          ))}
        </div>
      ) : showEmpty ? (
        <div className="p-5">{emptyState}</div>
      ) : (
        <>
          {/* Wide screens: a real table. Sticky header keeps column names visible while scrolling. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">{caption}</caption>
              <thead className="sticky top-0 z-10 bg-aura-s1">
                <tr>
                  {columns.map((column) => {
                    const direction = sort?.id === column.id ? sort.direction : null;
                    return (
                      <th
                        key={column.id}
                        scope="col"
                        aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : undefined}
                        className={cn(
                          "border-b border-aura-line px-5 py-3 text-[13px] font-medium text-text-muted whitespace-nowrap",
                          column.align === "right" ? "text-right" : "text-left",
                          column.priority === "secondary" && "hidden xl:table-cell",
                        )}
                      >
                        {column.sortValue ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column)}
                            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md text-text-muted hover:text-text-primary cursor-pointer transition-colors duration-150"
                          >
                            {column.header}
                            {direction === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : direction === "desc" ? (
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={getRowId(row)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (event) => activate(row, event) : undefined}
                    className={cn(
                      "border-b border-aura-line transition-colors duration-150 last:border-0",
                      onRowClick && "cursor-pointer hover:bg-aura-s2 focus-visible:bg-aura-s2 focus-visible:outline-none",
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          TABLE_CELL,
                          column.align === "right" && "text-right",
                          column.priority === "secondary" && "hidden xl:table-cell",
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Narrow screens: each row becomes a card with labelled values. */}
          <ul className="space-y-3 p-4 md:hidden" aria-label={caption}>
            {pageRows.map((row) => (
              <li
                key={getRowId(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => activate(row, event) : undefined}
                className={cn(
                  "rounded-2xl border border-aura-line bg-aura-s2 p-4 space-y-3",
                  onRowClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-blue/20",
                )}
              >
                {columns.map((column) => (
                  <div key={column.id} className="flex items-start justify-between gap-4">
                    <span className="text-[13px] text-text-muted">{column.header}</span>
                    <span className="min-w-0 text-right text-sm text-text-primary">{column.cell(row)}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>

          <footer className="flex flex-col gap-3 border-t border-aura-line px-5 py-3 text-[13px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono tabular-nums">
              {sorted.length === 0
                ? "No rows"
                : `${currentPage * pageSize + 1} to ${Math.min((currentPage + 1) * pageSize, sorted.length)} of ${sorted.length}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                aria-label="Previous page"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-aura-line2 text-text-secondary transition-colors duration-150 hover:text-text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[88px] text-center font-mono tabular-nums">
                Page {currentPage + 1} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
                disabled={currentPage >= pageCount - 1}
                aria-label="Next page"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-aura-line2 text-text-secondary transition-colors duration-150 hover:text-text-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
