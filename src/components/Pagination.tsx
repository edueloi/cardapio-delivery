import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { PAGE_SIZE_OPTIONS } from "@/src/lib/usePreferences";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaginationProps {
  /** Total number of items */
  total: number;
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Called when user changes page */
  onPageChange: (page: number) => void;
  /** Called when user changes page size */
  onPageSizeChange: (size: number) => void;
  /** Custom className for the container */
  className?: string;
  /** Whether to show the items-per-page selector */
  showPageSizeSelector?: boolean;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  pages.push(1);
  if (current > 4) pages.push("...");
  const start = Math.max(2, current - 2);
  const end   = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 3) pages.push("...");
  pages.push(total);
  return pages;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Pagination({
  total, page, pageSize, onPageChange, onPageSizeChange,
  className, showPageSizeSelector = true,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from       = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to         = Math.min(page * pageSize, total);

  const pageNumbers = getPageNumbers(page, totalPages);

  const btn = (
    icon: React.ReactNode,
    onClick: () => void,
    disabled: boolean,
    title: string,
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-8 h-8 flex items-center justify-center rounded-md border text-zinc-500 transition-all",
        disabled
          ? "opacity-30 cursor-not-allowed border-zinc-100 bg-zinc-50"
          : "border-zinc-200 bg-white hover:border-blue-400 hover:text-blue-600 active:scale-95",
      )}
    >
      {icon}
    </button>
  );

  return (
    <div className={cn(
      "ui-pagination flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-zinc-100 bg-zinc-50/30",
      className,
    )}>
      {/* Left: count info */}
      <p className="text-[11px] font-medium text-slate-500 shrink-0">
        {total === 0 ? "0 registros" : `${from}–${to} de ${total}`}
      </p>

      {/* Center: page controls */}
      <div className="flex max-w-full items-center gap-1">
        {btn(<ChevronsLeft size={13} />, () => onPageChange(1),           page <= 1,           "Primeira página")}
        {btn(<ChevronLeft  size={13} />, () => onPageChange(page - 1),    page <= 1,           "Página anterior")}

        <span className="px-2 text-xs text-slate-600 tabular-nums sm:hidden" aria-live="polite">{page} / {totalPages}</span>
        <div className="hidden items-center gap-1 sm:flex">
        {pageNumbers.map((p, idx) =>
          p === "..." ? (
            <span key={`e${idx}`} className="w-8 text-center text-xs text-zinc-300 font-medium">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p as number)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md text-xs font-medium transition-all",
                p === page
                  ? "bg-blue-400 text-white border border-blue-400 shadow-sm"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:border-blue-300 hover:text-blue-600",
              )}
            >
              {p}
            </button>
          )
        )}
        </div>

        {btn(<ChevronRight  size={13} />, () => onPageChange(page + 1),    page >= totalPages,  "Próxima página")}
        {btn(<ChevronsRight size={13} />, () => onPageChange(totalPages),   page >= totalPages,  "Última página")}
      </div>

      {/* Right: page size selector */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Por página</span>
          <select
            aria-label="Registros por página"
            value={pageSize}
            onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            className="h-8 px-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-all cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── usePagination hook (pure client-side) ───────────────────────────────────

export interface UsePaginationReturn<T> {
  page: number;
  pageSize: number;
  totalPages: number;
  paginatedData: T[];
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}

export function usePagination<T>(
  data: T[],
  initialPageSize = 15,
): UsePaginationReturn<T> {
  const [page,     setPageRaw]     = React.useState(1);
  const [pageSize, setPageSizeRaw] = React.useState(initialPageSize);

  const totalPages    = Math.max(1, Math.ceil(data.length / pageSize));
  const paginatedData = data.slice((page - 1) * pageSize, page * pageSize);

  const setPage = (p: number) => setPageRaw(Math.max(1, Math.min(p, totalPages)));
  const setPageSize = (s: number) => { setPageSizeRaw(s); setPageRaw(1); };

  // Reset to page 1 when data length changes (e.g. after filter)
  React.useEffect(() => { setPageRaw(1); }, [data.length]);

  return { page, pageSize, totalPages, paginatedData, setPage, setPageSize };
}
