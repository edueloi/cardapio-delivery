import React, { ReactNode, useState } from 'react';
import { CheckSquare, Square, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Pagination } from './Pagination';

export interface Column<T> {
  header: ReactNode | string;
  accessor?: keyof T;
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  sortKey?: string;
  hideOnMobile?: boolean; // Prop to hide specific generic columns in auto-generated mobile cards
}

export interface GridTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string | number;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: ReactNode | string;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  isLoading?: boolean;
  // Feature: Provide a custom card header for mobile (always visible part)
  renderMobileItem?: (row: T) => ReactNode;
  // Feature: Provide expandable body content for mobile cards (revealed on tap)
  renderMobileExpandedContent?: (row: T) => ReactNode;
  // Feature: Provide a left accent/avatar element for mobile cards
  renderMobileAvatar?: (row: T) => ReactNode;
  // Feature: Custom border color class per row on mobile (e.g. "border-amber-200")
  getMobileBorderClass?: (row: T) => string;
  // Feature: Force standard table even on mobile if needed
  disableMobileCards?: boolean;
  // Feature: Remove the card wrapper (border/shadow/rounded) from the desktop table — use when the parent already provides the container styling
  noDesktopCard?: boolean;
  // Pagination — when provided, GridTable renders a Pagination bar at the bottom
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}

function SortIndicator({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  if (!active) return <span className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 align-middle" />;
  return (
    <span className="inline-block ml-1.5 align-middle text-amber-500 leading-none font-black text-xs">
      {order === 'asc' ? '↑' : '↓'}
    </span>
  );
}

// ── Mobile card with optional expand ─────────────────────────────────────────

function MobileCard<T>({
  row,
  id,
  isSelectable,
  isSelected,
  onToggleSelect,
  onRowClick,
  renderMobileItem,
  renderMobileExpandedContent,
  renderMobileAvatar,
  getMobileBorderClass,
  autoContent,
}: {
  row: T;
  id: string;
  isSelectable: boolean;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  onRowClick?: (row: T) => void;
  renderMobileItem?: (row: T) => ReactNode;
  renderMobileExpandedContent?: (row: T) => ReactNode;
  renderMobileAvatar?: (row: T) => ReactNode;
  getMobileBorderClass?: (row: T) => string;
  autoContent: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = !!renderMobileExpandedContent;
  const borderClass = getMobileBorderClass ? getMobileBorderClass(row) : 'border-zinc-200';

  const handleHeaderClick = () => {
    if (isExpandable) {
      setExpanded(v => !v);
    } else {
      onRowClick?.(row);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors',
        isSelected ? 'border-amber-400 bg-amber-50/30' : borderClass,
      )}
    >
      {/* ── Header (always visible) ── */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3.5 transition-colors',
          (isExpandable || onRowClick) && 'cursor-pointer active:bg-zinc-50',
        )}
        onClick={handleHeaderClick}
      >
        {/* Checkbox */}
        {isSelectable && (
          <div className="pt-0.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onToggleSelect?.(id)}
              className="text-zinc-300 hover:text-amber-500 transition-colors"
            >
              {isSelected ? <CheckSquare size={18} className="text-amber-500" /> : <Square size={18} />}
            </button>
          </div>
        )}

        {/* Optional avatar/accent */}
        {renderMobileAvatar && (
          <div className="shrink-0">{renderMobileAvatar(row)}</div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {renderMobileItem ? renderMobileItem(row) : autoContent}
        </div>

        {/* Expand chevron or row-click arrow */}
        {isExpandable && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronDown size={16} className="text-zinc-300" />
          </motion.div>
        )}
      </div>

      {/* ── Expandable body ── */}
      {isExpandable && (
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-zinc-100">
                {renderMobileExpandedContent!(row)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

// ── Main GridTable ────────────────────────────────────────────────────────────

export function GridTable<T>({
  data, columns, keyExtractor, selectedIds, onToggleSelect, onToggleSelectAll,
  onRowClick, emptyMessage = 'Nenhum registro encontrado.', sortKey, sortOrder = 'asc', onSort, isLoading = false,
  renderMobileItem, renderMobileExpandedContent, renderMobileAvatar, getMobileBorderClass,
  disableMobileCards = false, noDesktopCard = false, pagination,
}: GridTableProps<T>) {
  const isSelectable = !!selectedIds && !!onToggleSelect;
  const allSelected = isSelectable && data.length > 0 && data.every((row) => selectedIds.has(String(keyExtractor(row))));

  // Auto-generated mobile card content (used when renderMobileItem is not provided)
  const renderAutoMobileCard = (row: T) => {
    const visibleCols = columns.filter(c => !c.hideOnMobile);
    const titleCol = visibleCols.find(c => typeof c.header === 'string' && c.header.toString().trim() !== '') || visibleCols[0];
    const detailsCols = visibleCols.filter(c => c !== titleCol && typeof c.header === 'string' && c.header.toString().trim() !== '');

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold text-sm text-zinc-900 pr-4 break-words line-clamp-1">
            {titleCol?.render ? titleCol.render(row) : titleCol?.accessor ? String(row[titleCol.accessor] ?? '') : ''}
          </div>
        </div>
        {detailsCols.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-zinc-100">
            {detailsCols.map((col, idx) => (
              <div key={idx} className="flex flex-col min-w-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-0.5 truncate">{col.header}</span>
                <span className="text-xs font-semibold text-zinc-700 truncate">
                  {col.render ? col.render(row) : col.accessor ? String(row[col.accessor] ?? '') : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* ─── DESKTOP TABLE VIEW ─── */}
      <div className={cn(
        !noDesktopCard && 'bg-white sm:border border-zinc-200 sm:rounded-2xl sm:shadow-sm',
        'overflow-hidden',
        !disableMobileCards && 'hidden sm:block',
      )}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse" style={{ minWidth: disableMobileCards ? 0 : 520 }}>
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                {isSelectable && (
                  <th className="px-4 py-3 w-10 text-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={onToggleSelectAll} className="text-zinc-400 hover:text-amber-600 transition-colors focus:outline-none">
                      {allSelected ? <CheckSquare size={16} className="text-amber-500" /> : <Square size={16} />}
                    </button>
                  </th>
                )}
                {columns.map((col, idx) => {
                  const isSortable = !!col.sortKey && !!onSort;
                  const isActive = isSortable && sortKey === col.sortKey;
                  return (
                    <th
                      key={idx}
                      onClick={isSortable ? () => onSort!(col.sortKey!) : undefined}
                      className={cn(
                        'px-4 py-3.5 text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap',
                        isSortable && 'cursor-pointer select-none hover:text-amber-600 transition-colors',
                        isActive && 'text-amber-600',
                        col.headerClassName,
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {col.header}
                        {isSortable && <SortIndicator active={isActive} order={sortOrder} />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse bg-white">
                    {isSelectable && <td className="px-4 py-4"><div className="h-4 w-4 bg-zinc-200 rounded mx-auto" /></td>}
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-zinc-100 rounded-md w-full max-w-[80%]" /></td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (isSelectable ? 1 : 0)} className="py-12 bg-white text-center text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => {
                  const id = String(keyExtractor(row));
                  const isSelected = isSelectable && selectedIds.has(id);
                  return (
                    <tr
                      key={id}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        'group transition-colors',
                        onRowClick && 'cursor-pointer',
                        isSelected ? 'bg-amber-50/50 hover:bg-amber-100/60' : rowIdx % 2 === 0 ? 'bg-white hover:bg-zinc-50/80' : 'bg-zinc-50/50 hover:bg-zinc-100/60',
                      )}
                    >
                      {isSelectable && (
                        <td className="px-4 py-3.5 text-center w-10 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => onToggleSelect(id)} className="text-zinc-300 hover:text-amber-500 transition-colors">
                            {isSelected ? <CheckSquare size={16} className="text-amber-500" /> : <Square size={16} />}
                          </button>
                        </td>
                      )}
                      {columns.map((col, idx) => (
                        <td key={idx} className={cn('px-4 py-3.5 text-xs text-zinc-700', col.className)}>
                          {col.render ? col.render(row) : col.accessor ? String(row[col.accessor] ?? '') : null}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MOBILE CARD VIEW ─── */}
      {!disableMobileCards && (
        <div className="block sm:hidden space-y-2 pb-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-3">
                <div className="h-4 bg-zinc-200 rounded-md w-2/3" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-8 bg-zinc-100 rounded-lg w-full" />
                  <div className="h-8 bg-zinc-100 rounded-lg w-full" />
                </div>
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="py-12 bg-white border border-zinc-200 border-dashed rounded-2xl text-center text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {emptyMessage}
            </div>
          ) : (
            data.map((row) => {
              const id = String(keyExtractor(row));
              const isSelected = isSelectable && selectedIds.has(id);
              return (
                <MobileCard
                  key={id}
                  row={row}
                  id={id}
                  isSelectable={isSelectable}
                  isSelected={isSelected}
                  onToggleSelect={onToggleSelect}
                  onRowClick={onRowClick}
                  renderMobileItem={renderMobileItem}
                  renderMobileExpandedContent={renderMobileExpandedContent}
                  renderMobileAvatar={renderMobileAvatar}
                  getMobileBorderClass={getMobileBorderClass}
                  autoContent={renderAutoMobileCard(row)}
                />
              );
            })
          )}
        </div>
      )}

      {/* ─── PAGINATION ─── */}
      {pagination && !isLoading && (
        <Pagination
          total={pagination.total}
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>
  );
}
