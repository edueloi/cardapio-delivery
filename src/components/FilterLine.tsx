import React from 'react';
import { Search, LayoutGrid, List as ListIcon } from 'lucide-react';
import { DatePicker } from './DatePicker';

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type FilterLineSectionAlign = 'left' | 'center' | 'right';

interface FilterLineProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface FilterLineSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  grow?: boolean;
  align?: FilterLineSectionAlign;
  wrap?: boolean;
}

interface FilterLineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  grow?: boolean;
  fullOnMobile?: boolean;
  minWidth?: number | string;
}

interface FilterLineGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  compact?: boolean;
}

interface FilterSegmentOption<T extends string | number = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface FilterLineSegmentedProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: FilterSegmentOption<T>[];
  className?: string;
  size?: 'sm' | 'md';
}

interface FilterLineViewToggleProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  gridValue: T;
  listValue: T;
  className?: string;
}

interface FilterLineSearchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface FilterLineDateRangeProps {
  from: string | null;
  to: string | null;
  onFromChange: (value: string | null) => void;
  onToChange: (value: string | null) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

export const FilterLine: React.FC<FilterLineProps> = ({ children, className = '', ...props }) => (
  <div className={cx('w-full rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm md:p-4', className)} {...props}>
    <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
      {children}
    </div>
  </div>
);

export const FilterLineSection: React.FC<FilterLineSectionProps> = ({
  children, className = '', grow = false, align = 'left', wrap = true, ...props
}) => (
  <div
    className={cx(
      'min-w-0 w-full xl:w-auto',
      grow && 'flex-1',
      'flex items-center gap-2 sm:gap-3',
      wrap ? 'flex-wrap' : 'flex-nowrap',
      align === 'left' && 'justify-start',
      align === 'center' && 'justify-center',
      align === 'right' && 'justify-between xl:justify-end',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const FilterLineItem: React.FC<FilterLineItemProps> = ({
  children, className = '', grow = false, fullOnMobile = true, minWidth, style, ...props
}) => (
  <div
    className={cx(fullOnMobile ? 'w-full sm:w-auto' : 'w-auto', grow && 'flex-1', className)}
    style={{ minWidth: minWidth ?? undefined, ...style }}
    {...props}
  >
    {children}
  </div>
);

export const FilterLineGroup: React.FC<FilterLineGroupProps> = ({
  children, className = '', compact = false, ...props
}) => (
  <div
    className={cx('inline-flex items-center rounded-xl bg-zinc-100', compact ? 'gap-1 p-1' : 'gap-1.5 p-1', className)}
    {...props}
  >
    {children}
  </div>
);

export function FilterLineSegmented<T extends string | number = string>({
  value, onChange, options, className = '', size = 'md',
}: FilterLineSegmentedProps<T>) {
  return (
    <FilterLineGroup compact={size === 'sm'} className={cx('w-full sm:w-auto sm:flex-nowrap', className)}>
      {options.map((option) => {
        const active = String(option.value) === String(value);
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              'inline-flex flex-1 justify-center items-center gap-1.5 rounded-lg font-bold transition-all sm:flex-none whitespace-nowrap',
              size === 'sm' ? 'px-2.5 py-1 h-7 text-[10px]' : 'px-3 py-2 text-[11px]',
              active ? 'bg-white text-amber-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </FilterLineGroup>
  );
}

export function FilterLineViewToggle<T extends string | number = string>({
  value, onChange, gridValue, listValue, className = '',
}: FilterLineViewToggleProps<T>) {
  const isGrid = String(value) === String(gridValue);
  const isList = String(value) === String(listValue);

  return (
    <div className={cx('inline-flex items-center rounded-xl border border-zinc-200 bg-white p-1', className)}>
      <button
        type="button"
        onClick={() => onChange(gridValue)}
        className={cx('inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all', isGrid ? 'bg-amber-50 text-amber-600' : 'text-zinc-400 hover:bg-zinc-50')}
        aria-label="Grade"
      >
        <LayoutGrid size={15} />
      </button>
      <button
        type="button"
        onClick={() => onChange(listValue)}
        className={cx('inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all', isList ? 'bg-amber-50 text-amber-600' : 'text-zinc-400 hover:bg-zinc-50')}
        aria-label="Lista"
      >
        <ListIcon size={15} />
      </button>
    </div>
  );
}

export const FilterLineSearch: React.FC<FilterLineSearchProps> = ({
  value, onChange, placeholder = 'Buscar...', className = '', ...props
}) => (
  <div className={cx(
    'flex h-10 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 transition-all',
    'focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/10 focus-within:bg-white',
    className
  )}>
    <Search size={15} className="shrink-0 text-zinc-400" />
    <input
      {...props}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-transparent text-xs font-bold text-zinc-800 outline-none placeholder:text-zinc-400 placeholder:font-normal"
    />
  </div>
);

export const FilterLineDateRange: React.FC<FilterLineDateRangeProps> = ({
  from, to, onFromChange, onToChange, fromLabel = 'De', toLabel = 'Até', className = '',
}) => (
  <div className={cx('flex w-full flex-col sm:flex-row sm:items-center gap-3 sm:gap-4', className)}>
    <div className="flex items-center gap-2 flex-1 sm:flex-none">
      <span className="w-5 shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-400">{fromLabel}</span>
      <div className="w-full sm:w-36">
        <DatePicker value={from} onChange={onFromChange} />
      </div>
    </div>
    <div className="flex items-center gap-2 flex-1 sm:flex-none">
      <span className="w-6 shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-400">{toLabel}</span>
      <div className="w-full sm:w-36">
        <DatePicker value={to} onChange={onToChange} />
      </div>
    </div>
  </div>
);
