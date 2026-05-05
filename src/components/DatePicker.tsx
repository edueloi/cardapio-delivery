import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from "@/src/lib/utils";
import { isHoliday } from '@/src/lib/holidays';

interface DatePickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  variant?: 'default' | 'ghost';
  showIcon?: boolean;
  renderTrigger?: (value: string | null) => React.ReactNode;
  label?: string;
  error?: string;
  hint?: string;
}

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function parseISODate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDisplayDate(dateStr?: string | null) {
  const date = parseISODate(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('pt-BR');
}

function formatISODate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isDateDisabled(date: Date, min?: string, max?: string) {
  const iso = formatISODate(date);
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

function getCalendarDays(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekDay = firstDayOfMonth.getDay();
  const gridStartDate = new Date(year, month, 1 - startWeekDay);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStartDate);
    date.setDate(gridStartDate.getDate() + index);
    return date;
  });
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Selecionar data',
  className = '',
  disabled = false,
  min,
  max,
  variant = 'default',
  showIcon = true,
  renderTrigger,
  label,
  error,
  hint,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = useMemo(() => parseISODate(value), [value]);

  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(selectedDate || new Date());
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [mode, setMode] = useState<'day' | 'month' | 'year'>('day');
  const [inputValue, setInputValue] = useState(value ? formatDisplayDate(value) : '');

  useEffect(() => { setInputValue(value ? formatDisplayDate(value) : ''); }, [value]);
  useEffect(() => { if (selectedDate) setViewDate(selectedDate); }, [selectedDate]);
  useEffect(() => { if (!isOpen) setTimeout(() => setMode('day'), 200); }, [isOpen]);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 380;
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldOpenUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setCoords({ top: shouldOpenUp ? rect.top - dropdownHeight - 8 : rect.bottom + 8, left: rect.left, width: rect.width });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => { window.removeEventListener('scroll', updateCoords, true); window.removeEventListener('resize', updateCoords); };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const calendarDays = useMemo(() => getCalendarDays(viewDate), [viewDate]);
  const today = new Date();

  const handleSelectDate = (date: Date) => {
    if (isDateDisabled(date, min, max)) return;
    onChange(formatISODate(date));
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length > 4) v = `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
    else if (v.length > 2) v = `${v.substring(0, 2)}/${v.substring(2)}`;
    setInputValue(v);
    if (v.length === 10) {
      const [d, m, y] = v.split('/').map(Number);
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
        const iso = formatISODate(date);
        if (!isDateDisabled(date, min, max)) { onChange(iso); setViewDate(date); }
      }
    } else if (v.length === 0) { onChange(null); }
  };

  const handlePrev = () => {
    if (mode === 'day') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    else if (mode === 'month') setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1));
    else if (mode === 'year') setViewDate(new Date(viewDate.getFullYear() - 12, viewDate.getMonth(), 1));
  };

  const handleNext = () => {
    if (mode === 'day') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    else if (mode === 'month') setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1));
    else if (mode === 'year') setViewDate(new Date(viewDate.getFullYear() + 12, viewDate.getMonth(), 1));
  };

  const yearRangeStart = Math.floor(viewDate.getFullYear() / 12) * 12;

  const dropdown = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[10000] w-[280px] rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 bg-zinc-50">
        <button type="button" onClick={handlePrev} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 transition">
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => { if (mode === 'day') setMode('month'); else if (mode === 'month') setMode('year'); }}
          className={`text-xs font-black text-zinc-700 px-3 py-1.5 rounded-lg transition-colors hover:bg-zinc-200 ${mode === 'year' ? 'cursor-default pointer-events-none' : 'cursor-pointer'}`}
        >
          {mode === 'day' && `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`}
          {mode === 'month' && viewDate.getFullYear()}
          {mode === 'year' && `${yearRangeStart} – ${yearRangeStart + 11}`}
        </button>
        <button type="button" onClick={handleNext} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {mode === 'day' && (
        <div>
          <div className="grid grid-cols-7 border-b border-zinc-100 px-2 pt-2 bg-zinc-50/50">
            {weekDays.map((day, index) => (
              <div key={index} className="flex h-8 items-center justify-center text-[9px] font-black uppercase tracking-widest text-zinc-400">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 px-2 py-2">
            {calendarDays.map((date, index) => {
              const isCurrentMonth = date.getMonth() === viewDate.getMonth();
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const disabledDate = isDateDisabled(date, min, max);
              return (
                <button
                  key={index}
                  type="button"
                  disabled={disabledDate}
                  onClick={() => handleSelectDate(date)}
                  title={isHoliday(date)?.name || (disabledDate ? 'Indisponível' : '')}
                  className={[
                    'flex h-8 items-center justify-center rounded-lg text-xs font-bold transition relative',
                    !isCurrentMonth ? 'text-zinc-300' : 'text-zinc-700',
                    isSelected ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600' : '',
                    isToday && !isSelected ? 'bg-amber-50 border border-amber-200 text-amber-700' : '',
                    !isSelected && !isToday ? 'hover:bg-amber-50 hover:text-amber-700' : '',
                    disabledDate ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : '',
                  ].join(' ')}
                >
                  {date.getDate()}
                  {isHoliday(date) && (
                    <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-red-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'month' && (
        <div className="grid grid-cols-3 gap-2 p-3 h-[260px]">
          {monthNames.map((m, i) => (
            <button key={i} type="button" onClick={() => { setViewDate(new Date(viewDate.getFullYear(), i, 1)); setMode('day'); }}
              className={`rounded-xl flex items-center justify-center font-bold text-xs transition-colors border ${viewDate.getMonth() === i ? 'bg-amber-500 text-white border-transparent' : 'bg-zinc-50 text-zinc-700 hover:bg-amber-50 border-zinc-200'}`}>
              {m.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {mode === 'year' && (
        <div className="grid grid-cols-3 gap-2 p-3 h-[260px]">
          {Array.from({ length: 12 }).map((_, i) => {
            const y = yearRangeStart + i;
            return (
              <button key={y} type="button" onClick={() => { setViewDate(new Date(y, viewDate.getMonth(), 1)); setMode('month'); }}
                className={`rounded-xl flex items-center justify-center font-bold text-xs transition-colors border ${viewDate.getFullYear() === y ? 'bg-amber-500 text-white border-transparent' : 'bg-zinc-50 text-zinc-700 hover:bg-amber-50 border-zinc-200'}`}>
                {y}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2 bg-zinc-50/80">
        <button type="button" onClick={() => { const now = new Date(); setViewDate(now); if (mode === 'day') handleSelectDate(now); else setMode('day'); }}
          className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-amber-600 hover:bg-amber-50 transition-colors">
          Hoje
        </button>
        <button type="button" onClick={() => { onChange(null); setIsOpen(false); }}
          className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors">
          Limpar
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  const inputStyles = variant === 'ghost' 
    ? "flex h-10 w-full items-center justify-center bg-transparent px-3 text-xs font-black text-zinc-800 transition-all placeholder:text-zinc-400 placeholder:font-normal focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:bg-transparent"
    : "flex h-10 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 pr-10 text-xs font-bold text-zinc-800 shadow-sm transition-all placeholder:text-zinc-400 placeholder:font-normal hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400";

  return (
    <div ref={containerRef} className={cn("flex flex-col gap-1.5", variant !== 'ghost' ? className : '')}>
      {label && (
        <label className="ds-label">
          {label}
        </label>
      )}

      <div className="relative group" onClick={() => !disabled && setIsOpen(true)}>
        {renderTrigger ? (
          renderTrigger(value)
        ) : (
          <>
            <input
              type="text"
              disabled={disabled}
              placeholder={placeholder}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={() => { if (inputValue.length > 0 && inputValue.length < 10) setInputValue(value ? formatDisplayDate(value) : ''); }}
              className={cn(inputStyles, variant === 'ghost' ? className : '')}
            />
            {showIcon && variant !== 'ghost' && (
              <CalendarDays size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none group-focus-within:text-amber-500 transition-colors" />
            )}
          </>
        )}
      </div>

      {error && (
        <p className="text-[11px] font-semibold text-red-500">{error}</p>
      )}
      {hint && !error && (
        <p className="text-[11px] text-zinc-400">{hint}</p>
      )}

      {dropdown}
    </div>
  );
};
